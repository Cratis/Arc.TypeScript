// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { serviceToken } from '@cratis/arc.core';
import type { ServiceToken } from '@cratis/arc.core';
import type { MongoCollection } from './MongoCollection.js';
const tokens = new WeakMap<new () => object, ServiceToken<MongoCollection<object>>>();
/** Stable DI token for a model's tenant-scoped collection. */
export function mongoCollection<T extends object>(type: new () => T): ServiceToken<MongoCollection<T>> {
    let token = tokens.get(type);
    if (!token) { token = serviceToken<MongoCollection<object>>(`MongoCollection<${type.name}>`); tokens.set(type, token); }
    return token as ServiceToken<MongoCollection<T>>;
}
