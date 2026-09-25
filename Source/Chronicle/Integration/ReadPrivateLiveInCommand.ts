// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, commandReadModel, inject, key } from '@cratis/arc.core';
import { PrivateLiveView } from './PrivateLiveView.js';

/** Read a projected personal value through command injection. */
@command()
export class ReadPrivateLiveInCommand {
    @field(String) @key() id = '';
    @inject(commandReadModel(PrivateLiveView))
    handle(view: PrivateLiveView): string { return view.name; }
}
