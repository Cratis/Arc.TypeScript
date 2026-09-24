// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Exact PascalCase wire discriminators understood by the installed client. */
export enum HubFrameType {
    Connected = 'Connected',
    Subscribe = 'Subscribe',
    Unsubscribe = 'Unsubscribe',
    QueryResult = 'QueryResult',
    Unauthorized = 'Unauthorized',
    Error = 'Error',
    Ping = 'Ping',
    Pong = 'Pong'
}
