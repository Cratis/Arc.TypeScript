// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, defaultValue, enumeration, nullable, optional } from '../../../index.js';
import { Message } from './Message.js';

@command()
export class SaveMessages {
    @field(Array, { genericArguments: [Message] }) messages!: Message[];
    @optional() @field(String) note?: string;
    @nullable() @field(String) alternative!: string | null;
    @defaultValue(1) @enumeration({ Standard: 1, Urgent: 2 }) @field(Number) priority!: number;
    handle(): string[] { return this.messages.map(item => item.name.value); }
}
