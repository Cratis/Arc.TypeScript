// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import { given } from '../../given.js';
import { mongoCollection } from '../../index.js';
import { a_tenant_collection, executionContext } from '../../for_MongoReadModels/given/a_tenant_collection.js';
import { TaskRecord } from '../given/TaskRecord.js';

should();
describe('when resolving a collection without a tenant', given(a_tenant_collection, context => {
    let error: unknown;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.addMongoDB({ client: context.client, database: 'tasks', readModels: [TaskRecord] });
        const application = await builder.build();
        const scope = application.server.services.createScope(executionContext());
        try { await scope.resolve(mongoCollection(TaskRecord)); }
        catch (failure) { error = failure; }
        finally { await scope.dispose(); await application.dispose(); }
    });
    it('should refuse access before selecting a database', () => {
        String(error).should.contain('Service factory failed');
        context.db.called.should.equal(false);
    });
}));
