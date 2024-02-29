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

type Base64Attachment = Attachment & {content: string};

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

    const errorAttachment: Base64Attachment = {
      contentType: '',
      contentUrl: '',
      content: 'error getting attachment from url',
    }

    const attachmentsBase64: Base64Attachment[] = [];
    for (const attachment of attachments) {
      // Retrieve the attachment via the attachment's contentUrl
      const url = attachment.contentUrl;

      try {
        // TODO (dylan): what does this response look like??
        // arraybuffer is necessary for images
        const response = await axios.get(url, { responseType: 'arraybuffer', responseEncoding: 'base64' });
        // const response = await axios.get(url, { responseType: 'arraybuffer' });
        // TODO (dylan): pre-parse JSON specially so it doesn't all render on one line?
        // if (response.headers['content-type'] === 'application/json') {
        //   response.data = JSON.parse(response.data, (key, value) => {
        //     return value && value.type === 'Buffer' ? Buffer.from(value.data) : value;
        //   });
        // }
        const attachmentBase64 = {
          ...attachment,
          // content: Buffer.from(response.data.content, 'base64').toString('base64'),
          content: response.data,
        }

        response.status === 200 ?
          attachmentsBase64.push(attachmentBase64)
          :
          attachmentsBase64.push(errorAttachment); // TODO (dylan): should we throw an error?
      } catch (e) {
        // TODO (dylan): should we throw an error?
        console.error(e);
        attachmentsBase64.push(errorAttachment);
      }
    }
    return attachmentsBase64;
  }

  const activityDeferredObservable = new DeferredObservable<Activity>(observer => {
    connectionStatusDeferredObservable.next(0);
    connectionStatusDeferredObservable.next(1);

    (async function () {
      const startConversationPromise = await startConversation();

      connectionStatusDeferredObservable.next(2);

      let [activities, getExecuteTurn] = iterateWithReturnValue(startConversationPromise);

      for (; ;) {
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
