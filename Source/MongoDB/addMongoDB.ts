// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplicationBuilder, serviceToken } from '@cratis/arc.core';
import type { ExecutionContext } from '@cratis/arc.core';
import { MongoClientFactory } from './MongoClientFactory.js';
import { MongoCollection } from './MongoCollection.js';
import type { MongoDBOptions } from './MongoDBOptions.js';
import { mongoCollection } from './collectionToken.js';

/** Register the MongoDB extension by importing this package. */
declare module '@cratis/arc.core' {
    interface ArcApplicationBuilder {
        /** Register scoped, tenant-aware MongoDB collections for the supplied read models. */
        addMongoDB(options: MongoDBOptions): this;
    }
}

/** Public token for applications needing to resolve clients explicitly. */
export const mongoClientFactory = serviceToken<MongoClientFactory>('MongoClientFactory');

ArcApplicationBuilder.prototype.addMongoDB = function (options: MongoDBOptions): ArcApplicationBuilder {
    if (!options.database && !options.databaseNameResolver) throw new Error('MongoDB requires database or databaseNameResolver');
    const factory = new MongoClientFactory(options);
    this.services.addSingleton(mongoClientFactory, () => factory);
    for (const type of options.readModels) {
        const token = mongoCollection(type);
        this.services.addScoped(token, async scope => {
            const context: ExecutionContext | undefined = scope.identity;
            if (!context?.tenantId) throw new Error('A tenant is required for MongoDB access');
            const name = options.databaseNameResolver ? options.databaseNameResolver(context.tenantId, context) :
                context.tenantId === 'default' ? options.database : `${options.database}+${context.tenantId}`;
            if (!name) throw new Error('MongoDB database resolver returned no database');
            const client = (await scope.resolve(mongoClientFactory)).get(context);
            const database = client.db(name);
            const collectionName = options.collectionName?.(type) ?? type.name;
            if (!collectionName) throw new Error('MongoDB collection name is required');
            return new MongoCollection(database.collection(collectionName), database, type, context,
                options.ignoreConventions, options.maxObservableItems, options.maxPageSize);
        });
    }
    return this;
};
