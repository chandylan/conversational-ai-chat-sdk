/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 */
import { type Activity, Message, UserRole, UnknownMedia, Attachment, User } from 'botframework-directlinejs';
import toDirectLineJS from './toDirectLineJS';


describe('to DirectLine JS', () => {
    const constructUser = (id: string, overrides?: Omit<User, 'id'>): User => ({
        id,
        ...overrides,
    });

    const constructActivity = (type: "message" | "typing" | "event", from: User, overrides?: Omit<Activity, 'type' | 'from'>): Activity => ({
        type,
        from,
        name: '',
        value: undefined,
        ...overrides,
    });

    const constructUnknownMediaAttachment = (contentType: string, contentUrl: string, overrides?: Omit<UnknownMedia, 'contentType' | 'contentUrl'>): UnknownMedia => ({
        contentType,
        contentUrl,
        ...overrides,
    });


    // TODO (dylan): also test Typing and EventActivity activities
    const basicUserMessage = constructActivity('message', constructUser('message-id', { role: 'user' }));
    // TODO (dylan): name attachment based on what it actually is, and give it a proper url
    const attachment = constructUnknownMediaAttachment('contentType', 'contentUrl');
    const messageWithAttachments = { ...basicUserMessage, attachments: [attachment] };

    const emptyAttachment = constructUnknownMediaAttachment('', '');
    const messageWithMalformedAttachment = { ...basicUserMessage, attachments: [emptyAttachment] }

    // TODO (dylan): mocks?

    // beforeEach(() => {
    //     jest.clearAllMocks();
    // });

    // positive scenarios

    // pass a basic activity, check that return value looks like:
    /**
     *  {
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
        }
     */
    const startConversation = () => 'TODO'; // TODO: steal from PPUX changes
    test('post a basic Activity', async () => {
        // TODO (dylan): is this right? what is it doing??
        const expectation = jest.fn();

        const directLine = toDirectLineJS(startConversation);
    });

    // pass an Activity with attachments, and check the return value looks the same as ^ but the attachments are an array of base64 strs
    test('post an Activity with attachments', async () => {
        // impl
    });

    // pass multiple Activities, check if the array forms properly

    // same for Activities with attachments

    // same with an Activity with multiple attachments


    // negative scenarios

    // TODO (dylan): what are some failure scenarios?
    // malformed Activities? malformed Attachments? failed to get Attachments?

    // pass an Activity with attachments with an invalid URL, and check the return value has that attachment's spot in the array as undefined
    test('post Activity with malformed attachment', async () => {
        // impl
    });
})