// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { enumeration } from '@cratis/arc.core';
import { field } from '@cratis/fundamentals';
import { Currency } from '../Shared/Currency.js';
import { Entity } from '../Shared/Entity.js';
import { Money } from '../Shared/Money.js';

export class Order extends Entity {
    @field(Money) total!: Money;
    @field(Money, true) lines!: Money[];
    @enumeration(Currency) @field(String) currency!: Currency;
}
