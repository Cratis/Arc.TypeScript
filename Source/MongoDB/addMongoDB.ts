// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplicationBuilder, serviceToken } from '@cratis/arc.core';
import type { ExecutionContext } from '@cratis/arc.core';
import { MongoClientFactory } from './MongoClientFactory.js';
import { MongoCollection } from './MongoCollection.js';
import { MongoReadModelForCommandResolver } from './MongoReadModelForCommandResolver.js';
import type { MongoDBOptions } from './MongoDBOptions.js';
import { mongoCollection } from './collectionToken.js';
import { defaultMongoNamingPolicy } from './MongoNamingPolicy.js';

/** Public token for applications needing to resolve clients explicitly. */
export const mongoClientFactory = serviceToken<MongoClientFactory>('MongoClientFactory');

export function withMongoDB(builder: ArcApplicationBuilder, configured: MongoDBOptions): ArcApplicationBuilder {
    const options = { ...builder.configuration.Cratis?.MongoDB, ...configured };
    if (!options.database && !options.databaseNameResolver) throw new Error('MongoDB requires database or databaseNameResolver');
    const factory = new MongoClientFactory(options);
    builder.services.addSingleton(mongoClientFactory, () => factory);
    builder.services.addScoped(MongoReadModelForCommandResolver, () => new MongoReadModelForCommandResolver(options));
    builder.addReadModelForCommandResolver(MongoReadModelForCommandResolver);
    for (const type of options.readModels) {
        const token = mongoCollection(type);
        builder.services.addScoped(token, async scope => {
            const context: ExecutionContext | undefined = scope.identity;
            if (!context?.tenantId) throw new Error('A tenant is required for MongoDB access');
            const tenantId = context.tenantId.toLowerCase();
            const name = options.databaseNameResolver ? options.databaseNameResolver(tenantId, context) :
                tenantId === 'default' ? options.database : `${options.database}+${tenantId}`;
            if (!name) throw new Error('MongoDB database resolver returned no database');
            const client = (await scope.resolve(mongoClientFactory)).get(context);
            const database = client.db(name);
            const namingPolicy = options.namingPolicy ?? defaultMongoNamingPolicy;
            const collectionName = options.collectionName?.(type) ?? namingPolicy.collectionName(type);
            if (!collectionName) throw new Error('MongoDB collection name is required');
            return new MongoCollection(database.collection(collectionName), database, type, context, {
                ignoreConventions: options.ignoreConventions, maxObservableItems: options.maxObservableItems,
                maxPageSize: options.maxPageSize, namingPolicy
            });
        });
    }
    return builder;
}

declare module '@cratis/arc.core' {
    interface ArcBuilderIntegrationOptions { mongodb: MongoDBOptions; }
}

/** @deprecated Use withMongoDB. */
export const addMongoDB = withMongoDB;
ArcApplicationBuilder.registerExtension('mongodb', withMongoDB);
