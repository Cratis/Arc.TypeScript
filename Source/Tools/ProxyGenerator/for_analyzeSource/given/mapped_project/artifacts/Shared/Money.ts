// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';

export class Money {
    @field(Number) amount!: number;
    @field(String) currency!: string;
}
