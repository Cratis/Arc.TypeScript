// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import type { FindOptions } from 'mongodb';
import { given } from '../../given.js';
import { a_tenant_collection, executionContext, type Task } from '../given/a_tenant_collection.js';

should();
describe('when finding with a conflicting signal', given(a_tenant_collection, context => {
    let signal: AbortSignal;
    beforeEach(async () => {
        const ctx = executionContext('a');
        signal = ctx.signal;
        await context.models.find(ctx, 'alice', { signal: new AbortController().signal } as FindOptions<Task>);
    });
    it('should use the authoritative context signal', () => {
        context.find.calledWithMatch({ owner: 'alice' }, { signal }).should.equal(true);
    });
}));
