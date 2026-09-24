// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { allowAnonymous, command } from '@cratis/arc.core';
import { FixtureCandidate } from './FixtureCandidate.js';
import { FixtureRate } from './FixtureRate.js';
@command({ namespace: 'HttpFixture' })
@allowAnonymous()
export class ValidationGraphCommand {
    @field(FixtureRate) rate!: FixtureRate;
    @field(Array, { genericArguments: [FixtureCandidate] }) candidates!: FixtureCandidate[];
    handle(): number { return this.candidates.length; }
}
