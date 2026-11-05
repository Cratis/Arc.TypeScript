// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field, Guid } from '@cratis/fundamentals';
import { key } from '@cratis/arc.core';

/** A document in the tenant's `WatcherItems` collection. */
export class WatcherItem {
    @field(Guid) @key() id!: Guid;
    @field(String) name!: string;
}
