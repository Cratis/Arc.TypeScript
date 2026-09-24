// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { derivedType, field } from '@cratis/fundamentals';
import { MessageBase } from './MessageBase.js';

/** Registered numeric derivative. */
@derivedType('number')
export class NumberMessage extends MessageBase {
    @field(Number) amount!: number;
}
