// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import { given } from '../../given.js';
import { mongoCollection } from '../../index.js';
import { a_replica_set } from '../given/a_replica_set.js';
import { TaskRecord } from '../given/TaskRecord.js';

should();
describe('when resolving a collection with an owned client', given(a_replica_set, context => {
    let models: TaskRecord[];
    beforeEach(async () => {
        if (!process.env.ARC_MONGO_TEST_URI) throw new Error('ARC_MONGO_TEST_URI is required');
        const builder = ArcApplication.createBuilder();
        builder.withMongoDB({ server: process.env.ARC_MONGO_TEST_URI, database: context.name,
            readModels: [TaskRecord] });
        const application = await builder.build();
        const scope = application.server.services.createScope(context.context('default'));
        try { models = await (await scope.resolve(mongoCollection(TaskRecord))).find(); }
        finally { await scope.dispose(); await application.dispose(); }
    });
    it('should connect with the URI and return a tenant-scoped collection', () => {
        models.should.deep.equal([]);
    });
}));
