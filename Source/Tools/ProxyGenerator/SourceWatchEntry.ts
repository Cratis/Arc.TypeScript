// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** File identity at a watch checkpoint; recent timestamps also need a content fingerprint. */
export interface SourceWatchEntry {
    readonly signature: string;
    readonly hash?: string;
}
