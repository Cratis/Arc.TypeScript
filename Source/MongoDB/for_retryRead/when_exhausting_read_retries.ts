// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { MongoNetworkError } from 'mongodb';
import { given } from '../given.js';
import { retryRead } from '../retryRead.js';

should();
class a_failing_read {
    readonly signal = new AbortController().signal;
    calls = 0;
    readonly error = new MongoNetworkError('unavailable');
}
describe('when exhausting read retries', given(a_failing_read, context => {
    let failure: unknown;
    beforeEach(async () => {
        try { await retryRead(async () => { context.calls++; throw context.error; }, context.signal); }
        catch (error) { failure = error; }
    });
    it('should report the original error without a partial result', () => {
        (failure as Error).should.equal(context.error);
        context.calls.should.equal(3);
    });
}));
