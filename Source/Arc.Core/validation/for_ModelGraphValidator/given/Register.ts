// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command } from '../../../commands/modelBound/command.js';
import { Entry } from './Entry.js';
export class Register {
    @field(Array, { genericArguments: [Entry] }) entries!: Entry[];
    handle(): string { return 'registered'; }
}
command()(Register);
