/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 */
import { type Activity, Message, UserRole, UnknownMedia, Attachment, User } from 'botframework-directlinejs';
import toDirectLineJS from './toDirectLineJS';
import createHalfDuplexChatAdapter from './createHalfDuplexChatAdapter';
import { HalfDuplexChatAdapterAPIStrategy } from './private/types/HalfDuplexChatAdapterAPIStrategy';
import { Transport } from './types/Transport';
import TestCanvasBotAPIStrategy from './TestCanvasBotAPIStrategy';
import { DirectLineJSBotConnection } from './types/DirectLineJSBotConnection';

function sleep(durationInMS = 0): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, durationInMS));
}

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


    const _next = jest.fn((): IteratorResult<Activity, string> => {
        const value = queue.shift();
        if (value) {
            return { value };
        }
        return { done: true, value: 'done' };
    });
    const _return = jest.fn((): IteratorResult<Activity, string> => {
        return { done: true, value: 'return' };
    });
    const _throw = jest.fn((): IteratorResult<Activity, string> => {
        return { done: true, value: 'throw' };
    });
    const _startConversation = jest.fn((): Promise<AsyncIterableIterator<Activity>> => {
        const iterator: AsyncIterableIterator<Activity> = {
            [Symbol.asyncIterator](): AsyncIterableIterator<Activity> {
                return iterator;
            },
            next: async (): Promise<IteratorResult<Activity, string>> => {
                await sleep();

                return _next();
            },
            return: async (): Promise<IteratorResult<Activity, string>> => {
                await sleep();

                return _return();
            },
            throw: async (): Promise<IteratorResult<Activity, string>> => {
                await sleep();

                return _throw();
            }
        };
        const startNewConversation = async () => {
            await sleep();
            return iterator;
        }
        return startNewConversation();
    });

    // const _createExecuteTurn = jest.fn((emitStartConversationEvent: boolean): Promise<AsyncIterableIterator<Activity>> => {
    //     const iterator: AsyncIterableIterator<Activity> = {
    //         [Symbol.asyncIterator](): AsyncIterableIterator<Activity> {
    //             return iterator;
    //         },
    //         next: async (): Promise<IteratorResult<Activity, string>> => {
    //             await sleep();

    //             return _next();
    //         },
    //         return: async (): Promise<IteratorResult<Activity, string>> => {
    //             await sleep();

    //             return _return();
    //         },
    //         throw: async (): Promise<IteratorResult<Activity, string>> => {
    //             await sleep();

    //             return _throw();
    //         }
    //     };
    //     const startNewConversation = async () => {
    //         await sleep();
    //         return iterator;
    //     }
    //     return startNewConversation();
    // });

    type ExecuteTurnFunction = (activity: Activity) => Promise<TurnGenerator>;
    type TurnGenerator = AsyncGenerator<Activity, ExecuteTurnFunction, undefined>;

    type HalfDuplexChatAdapterAPIParams = Parameters<typeof createHalfDuplexChatAdapter>;
    type HalfDuplexChatAdapterAPIReturn = ReturnType<typeof createHalfDuplexChatAdapter>;

    const startConversation: HalfDuplexChatAdapterAPIReturn = jest.fn(async () => {
        const activities = await _startConversation();
        return (async function* (): TurnGenerator {
            yield* activities;
            // return _createExecuteTurn(true);
            return jest.fn();
        })();
    });

    // const mockTurn = () => {
    //     // TODO (dylan): update mocks to actually be useful
    //     const mockGetTokenCallback = jest.fn();
    //     const mockBaseURL = new URL(`/environments/${encodeURI('mockEnvId')}/bots/${encodeURI('mockBotId')}/test`, new URL('mockIslandURI'));
    //     const transport: Transport = 'rest';
    //     return { baseURL: mockBaseURL, headers: { authorization: `Bearer ${mockGetTokenCallback}` }, transport };
    // };
    // const mockAPICall: ReturnType<HalfDuplexChatAdapterAPIStrategy['prepareExecuteTurn']> = (async () => {
    //     await sleep();

    //     return mockTurn();
    // })();
    // const mockTestCanvasBotAPIStrategy = jest.fn(() => ({
    //     prepareExecuteTurn: () => mockAPICall,
    //     prepareStartNewConversation: () => mockAPICall
    // }))

    // jest.mock('./TestCanvasBotAPIStrategy', () => {
    //     return jest.fn().mockImplementation(() => {
    //         return {
    //             TestCanvasBotAPIStrategy: jest.fn(() => ({
    //                 prepareExecuteTurn: mockAPICall,
    //                 prepareStartNewConversation: mockAPICall
    //             }))
    //         };
    //     });
    // });

    // jest.mock('./createHalfDuplexChatAdapter', () => {
    //     return jest.fn().mockImplementation(() => {
    //         const activities = [basicUserMessage];
    //         return (async function* () {
    //             yield* activities;
    //             return jest.fn();
    //         })
    //     });
    // })

    let queue: Activity[] = [basicUserMessage];

    beforeEach(() => {
        jest.clearAllMocks();

        // queue = [basicUserMessage];
    });

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
    test('post a basic Activity', async () => {
        // TODO (dylan): is this right? what is it doing??
        // const expectation = jest.fn();

        queue = [basicUserMessage];

        const directLine: DirectLineJSBotConnection = toDirectLineJS(
            //     createHalfDuplexChatAdapter(new TestCanvasBotAPIStrategy({
            //     environmentId: 'mockEnvId',
            //     botId: 'mockBotId',
            //     transport: 'rest',
            //     getTokenCallback: jest.fn(),
            //     islandURI: new URL('mockIslandURI'),
            // }))
            startConversation
        );

        expect(directLine).toHaveBeenCalledTimes(1);
        expect(directLine).toHaveNthReturnedWith(1, { value: [basicUserMessage] });
    });

    // pass multiple Activities, check all the responses are correct

    // pass an Activity with attachments, and check the return value looks the same as ^ but the attachments are an array of base64 strs
    test('post an Activity with attachments', async () => {
        queue = [messageWithAttachments];

        const directLine: DirectLineJSBotConnection = toDirectLineJS(
            //     createHalfDuplexChatAdapter(new TestCanvasBotAPIStrategy({
            //     environmentId: 'mockEnvId',
            //     botId: 'mockBotId',
            //     transport: 'rest',
            //     getTokenCallback: jest.fn(),
            //     islandURI: new URL('mockIslandURI'),
            // }))
            startConversation
        );

        expect(directLine).toHaveBeenCalledTimes(1);
        const expectedMessageBase64 = {
            ...messageWithAttachments,
            attachments: [], // TODO (dylan): what should this attachment be?
        }
        expect(directLine).toHaveNthReturnedWith(1, { value: [expectedMessageBase64] });
    });

    // pass an Activity with multiple attachments, check if the array forms properly





    // negative scenarios

    // TODO (dylan): what are some failure scenarios?
    // malformed Activities? malformed Attachments? failed to get Attachments?

    // pass an Activity with attachments with an invalid URL, and check the return value has that attachment's spot in the array as undefined
    test('post Activity with malformed attachment', async () => {
        // impl
    });
})