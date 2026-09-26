// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { allowAnonymous, command } from '@cratis/arc.core';
import { recordFilterParity } from './FilterParityObservations.js';

/** Exercise command filter ordering and validation over HTTP. */
@command({ namespace: 'HttpFixture' })
@allowAnonymous()
export class FilterParityCommand {
    @field(String) value!: string;
    handle(): string { recordFilterParity('command handler', this.value); return this.value; }
}
