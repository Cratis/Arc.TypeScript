// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_tenant_collection, executionContext } from '../given/a_tenant_collection.js';
import { capture_error, should_reject_with_error } from '../given/should_reject_with_error.js';
import { MongoReadModels } from '../../MongoReadModels.js';

should();
describe('when resolving a tenant without a database', given(a_tenant_collection, context => {
    let failure: unknown;
    beforeEach(async () => {
        const models = new MongoReadModels({ client: context.client, databaseForTenant: () => '', filterFor: (owner: string) => ({ owner }) }, 'tasks');
        failure = await capture_error(models.find(executionContext('a'), 'alice'));
    });
    it('should reject the read asynchronously', () => should_reject_with_error(failure, 'no database'));
}));
