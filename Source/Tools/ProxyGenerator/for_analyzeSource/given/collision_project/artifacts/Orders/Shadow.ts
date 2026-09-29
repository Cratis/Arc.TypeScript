// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '@cratis/arc.core';
import { field } from '@cratis/fundamentals';
import { Command as SharedCommand } from '../Shared/Command.js';

@command()
export class Shadow {
    @field(SharedCommand) other!: SharedCommand;
    handle(): void {}
}
