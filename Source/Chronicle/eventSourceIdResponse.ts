// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Explicitly select a Chronicle event source id while returning the id to the client. */
export class EventSourceIdResponse {
    constructor(readonly value: string) {}
}
export function eventSourceIdResponse(value: string): EventSourceIdResponse {
    return new EventSourceIdResponse(value);
}
