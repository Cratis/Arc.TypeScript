// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '@cratis/arc.core';
import { field } from '@cratis/fundamentals';
import { Money } from '../Shared/Money.js';
import { Order } from './Order.js';

@command()
export class PlaceOrder {
    @field(Money) price!: Money;
    handle(): Order { return new Order(); }
}
