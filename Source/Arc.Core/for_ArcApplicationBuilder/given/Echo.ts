// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command } from '../../index.js';
@command()
export class Echo {
    @field(String) message!: string;
    handle(): string { return this.message; }
}
