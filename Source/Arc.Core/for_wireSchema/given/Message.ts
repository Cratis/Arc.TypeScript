// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { ItemName } from '../../for_ArcApplication/given/ItemName.js';
export class Message {
    @field(ItemName) name!: ItemName;
}
