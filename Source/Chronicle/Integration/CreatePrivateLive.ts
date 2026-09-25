// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, key } from '@cratis/arc.core';
import { PrivateLiveCreated } from './PrivateLiveCreated.js';

/** Create a personal-data fixture in the live Chronicle kernel. */
@command()
export class CreatePrivateLive {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle(): PrivateLiveCreated { return new PrivateLiveCreated(this.name); }
}
