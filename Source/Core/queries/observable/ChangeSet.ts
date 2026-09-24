// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Full items added, replaced, or removed between delivered collection snapshots. */
export interface ChangeSet<T> {
    readonly added: T[];
    readonly replaced: T[];
    readonly removed: T[];
}
