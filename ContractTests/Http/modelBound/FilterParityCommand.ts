// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { allowAnonymous, command } from '@cratis/arc.core';

/** Exercise command filter ordering and validation over HTTP. */
@command({ namespace: 'HttpFixture' })
@allowAnonymous()
export class FilterParityCommand {
    @field(String) value!: string;
    handle(): string { return this.value; }
}
