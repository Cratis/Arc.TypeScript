// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ObjectId } from 'mongodb';
import { given } from '../../given.js';
import { a_tenant_collection, executionContext, type Task } from '../given/a_tenant_collection.js';
import { capture_error, should_reject_with_error } from '../given/should_reject_with_error.js';

should();
describe('when finding by id with an unsafe id', given(a_tenant_collection, context => {
    let found: Task | null;
    let ctx: ReturnType<typeof executionContext>;
    let invalid: unknown[];
    beforeEach(async () => {
        ctx = executionContext('a');
        context.findOne.resetHistory();
        found = await context.models.findById(ctx, 'alice', context.doc._id);
        invalid = await Promise.all([context.models.findById(ctx, 'alice', { $ne: null } as unknown as ObjectId),
            context.models.findById(ctx, 'alice', { value: 'id' } as unknown as ObjectId)].map(capture_error));
    });
    it('should return the matching document', () => found!.should.deep.equal(context.doc));
    it('should combine the trusted filter and safe id', () => {
        context.filterFor.calledWith('alice', ctx).should.equal(true);
        context.findOne.calledWithMatch({ $and: [{ owner: 'alice' }, { _id: context.doc._id }] }, { signal: ctx.signal }).should.equal(true);
    });
    it('should reject unsafe ids without querying', () => {
        for (const failure of invalid) should_reject_with_error(failure, 'A primitive or BSON ObjectId');
        context.findOne.calledOnce.should.equal(true);
    });
}));
