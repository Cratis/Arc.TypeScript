// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Query result shape, independent of the hosting or delivery protocol. */
export enum QueryTransport {
    Snapshot = 'snapshot',
    Observable = 'observable',
    Unknown = 'unknown'
}
