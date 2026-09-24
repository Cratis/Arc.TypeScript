// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { allowAnonymous, authorize, path, query, readModel, argument } from '@cratis/arc.core';
import { FixtureRate } from './FixtureRate.js';

/** A command-level policy is exercised by the explicit policy echo fixture. */
@readModel({ namespace: 'HttpFixture' })
@authorize({ policy: 'FixtureAdmin' })
export class PolicyItems {
    @field(String) value!: string;

    @path('/api/policy-items')
    @query()
    static All(): PolicyItems { return Object.assign(new PolicyItems(), { value: 'allowed' }); }
}

/** A query binding a numeric concept argument. */
@readModel({ namespace: 'HttpFixture' })
export class RateLookup {
    @field(Number) value!: number;

    @allowAnonymous()
    @path('/api/rate-lookup')
    @query(argument('rate', FixtureRate))
    static ByRate(rate: FixtureRate): RateLookup { return Object.assign(new RateLookup(), { value: rate.value }); }
}
