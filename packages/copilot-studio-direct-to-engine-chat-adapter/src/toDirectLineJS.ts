/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 */

import { type Activity, UnknownMedia, Attachment } from 'botframework-directlinejs';
import {
  DeferredObservable,
  DeferredPromise,
  Observable,
  shareObservable
} from 'powerva-turn-based-chat-adapter-framework';
import { v4 } from 'uuid';

import type createHalfDuplexChatAdapter from './createHalfDuplexChatAdapter';
import iterateWithReturnValue from './private/iterateWithReturnValueAsync';
import { type ActivityId, type DirectLineJSBotConnection } from './types/DirectLineJSBotConnection';

import axios from 'axios';

export default function toDirectLineJS(
  startConversation: ReturnType<typeof createHalfDuplexChatAdapter>
): DirectLineJSBotConnection {
  let nextSequenceId = 0;
  let postActivityDeferred = new DeferredPromise<readonly [Activity, (id: ActivityId) => void]>();

  // TODO: Find out why replyToId is pointing to nowhere.
  // TODO: Can the service add "timestamp" field?
  // TODO: Can the service echo back the activity?
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const patchActivity = async ({ replyToId: _, ...activity }: Activity & { replyToId?: string }): Promise<Activity> => {
    // TODO (dylan): is there a way to only do this conversion if we haven't already done it?
    if (activity.type === 'message') {
      const attachmentsBase64 = await convertAttachmentsToBase64(activity.attachments as UnknownMedia[]);
      activity.attachments = attachmentsBase64;
    }
    return {
      ...activity,
      channelData: { ...activity.channelData, 'webchat:sequence-id': nextSequenceId++ },
      timestamp: new Date().toISOString()
    };
  };

  async function convertAttachmentsToBase64(attachments: UnknownMedia[] | undefined) {
    if (!attachments || attachments.length < 1) {
      return undefined;
    }

    const attachmentsStrings = [];
    for (const attachment of attachments) {
      // TODO (dylan): is this the right way to do this??? wouldn't it be easier to just read the file directly into a buffer 
      // instead of going to the trouble of saving it to local storage first??
      // TODO (dylan): where do we save this URL in the first place??
      
      // Retrieve the attachment via the attachment's contentUrl
      const url = attachment.contentUrl;

      try {
        // TODO (dylan): is axios the way to do this?
        // (TODO (dylan): remove) ah, axios response: https://axios-http.com/docs/res_schema
        // also: axios request config: https://axios-http.com/docs/req_config

        // arraybuffer is necessary for images
        const response = await axios.get(url, { responseType: 'arraybuffer', responseEncoding: 'base64' });
        // if this doesn't return what you expect, you may need to convert the arraybuffer to a base64 string somehow
        // TODO (dylan): see if this works, if not try convertToBase64() above:
        // return convertAxiosResponseStringToBase64(response.data, response.headers['content-type'] === 'application/json');

        response.status === 200 ?
          attachmentsStrings.push(response.data)
          :
          attachmentsStrings.push(undefined);
      } catch (e) {
        console.error(e);
        attachmentsStrings.push(undefined);
      }
    }
    return attachmentsStrings;
  }

  const activityDeferredObservable = new DeferredObservable<Activity>(observer => {
    connectionStatusDeferredObservable.next(0);
    connectionStatusDeferredObservable.next(1);

    (async function () {
      const startConversationPromise = await startConversation();

      connectionStatusDeferredObservable.next(2);

      let [activities, getExecuteTurn] = iterateWithReturnValue(startConversationPromise);

      for (;;) {
        for await (const activity of activities) {
          const patchedActivity = await patchActivity(activity);
          observer.next(patchedActivity);
        }

        const executeTurn = getExecuteTurn();
        const [activity, callback] = await postActivityDeferred.promise;

        const activityId = v4() as ActivityId;
        const executeTurnActivities = await executeTurn(activity);

        const patchedActivity = await patchActivity({ ...activity, id: activityId })
        observer.next(patchedActivity);
        callback(activityId);

        [activities, getExecuteTurn] = iterateWithReturnValue(executeTurnActivities);
      }
    })();
  });

  const connectionStatusDeferredObservable = new DeferredObservable<number>();

  return {
    activity$: shareObservable(activityDeferredObservable.observable),
    connectionStatus$: shareObservable(connectionStatusDeferredObservable.observable),
    end() {
      // Half-duplex connection does not requires implicit closing.
    },
    postActivity: (activity: Activity) =>
      shareObservable(
        new Observable<ActivityId>(observer => {
          postActivityDeferred.resolve(Object.freeze([activity, id => observer.next(id)]));
          postActivityDeferred = new DeferredPromise();
        })
      )
  };
}
