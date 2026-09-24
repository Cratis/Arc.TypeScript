// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import { given } from '../../given.js';
import { addMongoDB, mongoCollection } from '../../index.js';
import { a_tenant_collection, executionContext } from '../../for_MongoReadModels/given/a_tenant_collection.js';
import { TaskRecord } from '../given/TaskRecord.js';

should();
describe('when resolving a collection for the default tenant', given(a_tenant_collection, context => {
    it('should use the bare database and pluralized collection name even for mixed-case tenant input', async () => {
        const builder = ArcApplication.createBuilder();
        addMongoDB(builder, { client: context.client, database: 'tasks', readModels: [TaskRecord] });
        const application = await builder.build();
        const scope = application.server.services.createScope(executionContext('Default'));
        try {
            const collection = await scope.resolve(mongoCollection(TaskRecord));
            (context.db.firstCall.args[0] ?? '').should.equal('tasks');
            collection.native.should.equal(context.collection);
        } finally { await scope.dispose(); await application.dispose(); }
    });
}));
