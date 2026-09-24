// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { currentServices } from '@cratis/arc.core';
import type { ClassType, ReadModelForCommandResolver } from '@cratis/arc.core';
import type { MongoDBOptions } from './MongoDBOptions.js';
import { mongoCollection } from './collectionToken.js';

/** Resolve an explicitly registered MongoDB model using its declared document key. */
export class MongoReadModelForCommandResolver implements ReadModelForCommandResolver {
    constructor(private readonly options: MongoDBOptions) {}
    supports(type: ClassType): boolean { return this.options.readModels.includes(type as never); }
    async find<T>(type: ClassType<T>, key: string): Promise<T | null> {
        const collection = await currentServices().resolve(mongoCollection(type as unknown as new () => object));
        return collection.findById(key) as Promise<T | null>;
    }
}
