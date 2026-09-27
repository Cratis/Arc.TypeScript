// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, Severity } from '@cratis/arc.core';
import type { MongoClient } from 'mongodb';
import { mongoCollection } from '../collectionToken.js';
import { TaskRecord } from '../for_MongoCollection/given/TaskRecord.js';
import '../withMongoDB.js';

should();
describe('when resolving a MongoDB collection after changing its context tenant', () => {
    let requestedDatabase: string;
    beforeEach(async () => {
        const client = { db: (name: string) => {
            requestedDatabase = name;
            return { collection: () => ({}) };
        } } as unknown as MongoClient;
        const builder = ArcApplication.createBuilder();
        builder.withMongoDB({ client, database: 'Items', readModels: [TaskRecord] });
        const application = await builder.build();
        const identity = { tenantId: 'first', correlationId: crypto.randomUUID(), principal: undefined,
            signal: new AbortController().signal, allowedSeverity: Severity.Warning };
        const scope = application.server.services.createScope(identity);
        identity.tenantId = 'second';
        try { await scope.resolve(mongoCollection(TaskRecord)); }
        finally { await scope.dispose(); await application.dispose(); }
    });
    it('should resolve the creation-time tenant database', () => requestedDatabase.should.equal('Items+first'));
});
