// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { derivedType, field } from '@cratis/fundamentals';
import { MessageBase } from './MessageBase.js';

/** Registered text derivative. */
@derivedType('text')
export class TextMessage extends MessageBase {
    @field(String) text!: string;
}
