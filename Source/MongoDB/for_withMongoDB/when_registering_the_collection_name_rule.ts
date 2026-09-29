// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, readModelCollectionNameResolver, Severity } from '@cratis/arc.core';
import type { ReadModelCollectionName } from '@cratis/arc.core';
import type { MongoClient } from 'mongodb';
import { TaskRecord } from '../for_MongoCollection/given/TaskRecord.js';
import { camelCaseMongoNamingPolicy } from '../MongoNamingPolicy.js';
import { resolveMongoCollectionName } from '../resolveMongoCollectionName.js';
import '../withMongoDB.js';

class Unregistered {}

should();
describe('when registering MongoDB with a naming policy and a collection override', () => {
    const overridden = (type: new () => object) => type === TaskRecord ? 'Tasks' : `${type.name}!`;
    let rule: ReadModelCollectionName;
    let ruleWithoutOverride: ReadModelCollectionName;
    beforeEach(async () => {
        const client = {} as MongoClient;
        const resolve = async (options: { collectionName?: typeof overridden }) => {
            const builder = ArcApplication.createBuilder();
            builder.withMongoDB({ client, database: 'Items', readModels: [TaskRecord], namingPolicy: camelCaseMongoNamingPolicy, ...options });
            const application = await builder.build();
            const scope = application.server.services.createScope({ tenantId: 'default', correlationId: crypto.randomUUID(),
                principal: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Warning });
            try { return await scope.resolve(readModelCollectionNameResolver); }
            finally { await scope.dispose(); await application.dispose(); }
        };
        rule = await resolve({ collectionName: overridden });
        ruleWithoutOverride = await resolve({});
    });
    it('should expose the override to other integrations', () => rule(TaskRecord).should.equal('Tasks'));
    it('should expose the naming policy name when there is no override', () => ruleWithoutOverride(TaskRecord).should.equal('taskRecords'));
    it('should leave a class that is not registered to the other integration', () =>
        (ruleWithoutOverride(Unregistered) === undefined).should.equal(true));
    it('should resolve the same name as Arc reads the collection from', () =>
        ruleWithoutOverride(TaskRecord).should.equal(resolveMongoCollectionName({ namingPolicy: camelCaseMongoNamingPolicy }, TaskRecord)));
});
