// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, Severity } from '@cratis/arc.core';
import type { ArcApplicationBuilder } from '@cratis/arc.core';
import { camelCaseMongoNamingPolicy, resolveMongoCollectionName } from '@cratis/arc.mongodb';
import type { MongoDBOptions } from '@cratis/arc.mongodb';
import { ChronicleOptions } from '@cratis/chronicle';
import type { ReadModelNamingPolicy } from '@cratis/chronicle';
import sinon from 'sinon';
import '../index.js';
import { ChronicleRuntime } from '../ChronicleRuntime.js';
import { Author, Reviewer } from './given/a_read_model_class.js';

const mongoDB: MongoDBOptions = {
    client: {} as MongoDBOptions['client'], database: 'Library', readModels: [Author],
    namingPolicy: camelCaseMongoNamingPolicy, collectionName: type => `${type.name}Documents`
};
const chronicle = { connectionString: 'chronicle://localhost:35000', eventStore: 'Library' };
const orders: [string, (builder: ArcApplicationBuilder) => void][] = [
    ['withMongoDB before withChronicle', builder => { builder.withMongoDB(mongoDB); builder.withChronicle(chronicle); }],
    ['withChronicle before withMongoDB', builder => { builder.withChronicle(chronicle); builder.withMongoDB(mongoDB); }]
];

for (const [order, register] of orders) {
    describe(`when the real withMongoDB and withChronicle are registered (${order})`, () => {
        let fromConnectionString: sinon.SinonSpy;
        let policy: ReadModelNamingPolicy;
        beforeEach(async () => {
            fromConnectionString = sinon.spy(ChronicleOptions, 'fromConnectionString');
            const builder = ArcApplication.createBuilder();
            register(builder);
            const application = await builder.build();
            const scope = application.server.services.createScope({ tenantId: 'default', correlationId: crypto.randomUUID(),
                principal: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Warning });
            try {
                await scope.resolve(ChronicleRuntime);
                policy = fromConnectionString.lastCall.args[1].readModelNamingPolicy;
            } finally { await scope.dispose(); await application.dispose(); fromConnectionString.restore(); }
        });
        it('should name a registered class as the MongoDB integration resolves it', () => {
            policy('Author', Author).should.equal(resolveMongoCollectionName(mongoDB, Author));
        });
        it('should use the collection name override for that class', () => { policy('Author', Author).should.equal('AuthorDocuments'); });
        it('should keep the identifier when there is no class', () => { policy('custom-container').should.equal('custom-container'); });
        it('should keep the identifier for a class MongoDB does not read', () => { policy('Reviewer', Reviewer).should.equal('Reviewer'); });
    });
}
