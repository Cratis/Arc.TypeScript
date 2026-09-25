// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { MongoNetworkError } from 'mongodb';
import { given } from '../given.js';
import { retryRead } from '../retryRead.js';

should();
class a_transient_read {
    readonly signal = new AbortController().signal;
    calls = 0;
}
describe('when retrying a transient read', given(a_transient_read, context => {
    let value: number;
    beforeEach(async () => {
        value = await retryRead(async () => {
            context.calls++;
            if (context.calls < 3) throw new MongoNetworkError('transient');
            return 42;
        }, context.signal);
    });
    it('should return the recovered value after two retries', () => {
        value.should.equal(42);
        context.calls.should.equal(3);
    });
}));
