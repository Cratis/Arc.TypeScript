// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { derivedType, field } from '@cratis/fundamentals';
import { BaseItem } from './BaseItem.js';

@derivedType('special')
export class SpecialItem extends BaseItem {
    @field(Number) priority!: number;
}
