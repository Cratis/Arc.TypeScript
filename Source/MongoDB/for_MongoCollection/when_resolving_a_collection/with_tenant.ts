// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import { given } from '../../given.js';
import { mongoCollection } from '../../index.js';
import { a_tenant_collection, executionContext } from '../../for_MongoReadModels/given/a_tenant_collection.js';
import { TaskRecord } from '../given/TaskRecord.js';

should();
describe('when resolving a collection with a tenant', given(a_tenant_collection, context => {
    let databaseName: string;
    let collectionMatches: boolean;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.withMongoDB({ client: context.client, database: 'tasks', readModels: [TaskRecord] });
        const application = await builder.build();
        const identity = { ...executionContext('acme') };
        const scope = application.server.services.createScope(identity);
        identity.tenantId = 'other';
        try {
            const collection = await scope.resolve(mongoCollection(TaskRecord));
            collectionMatches = Object.is(collection.native, context.collection);
            databaseName = context.db.firstCall.args[0]!;
        } finally { await scope.dispose(); await application.dispose(); }
    });
    it('should use the tenant-specific database', () => { databaseName.should.equal('tasks+acme'); });
    it('should resolve the configured collection', () => { collectionMatches.should.equal(true); });
}));
