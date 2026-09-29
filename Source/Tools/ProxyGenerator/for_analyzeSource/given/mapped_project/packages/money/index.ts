// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';

/** A stand-in for a model published from another package. */
export class Money {
    @field(Number) amount!: number;
    @field(String) currency!: string;
}
export class Entity {
    @field(String) id!: string;
}
export enum Currency { Nok = 'nok', Usd = 'usd' }
export class Price {
    @field(Number) amount!: number;
}
