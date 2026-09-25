// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Kind of client-visible operation. */
export enum ClientOperationKind {
    /** A command operation. */
    Command = 'command',
    /** A query operation. */
    Query = 'query',
    /** An observable query operation. */
    Observable = 'observable'
}
