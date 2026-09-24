// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { serviceToken } from '@cratis/arc.core';
import type { ServiceToken } from '@cratis/arc.core';
import type { DrizzleHandle } from './DrizzleHandle.js';
import type { DrizzleDatabase } from './DrizzleOptions.js';
import type { DrizzleReadModels } from './DrizzleReadModels.js';

/** Writable tenant-specific database token; inject with `service(drizzle())` when writes are intended. */
export const drizzle = <T extends DrizzleDatabase = DrizzleDatabase>(): ServiceToken<DrizzleHandle<T>> =>
    databaseToken as ServiceToken<DrizzleHandle<T>>;
const databaseToken = serviceToken<DrizzleHandle>('DrizzleDatabase');
const tokens = new WeakMap<new () => object, ServiceToken<DrizzleReadModels<object>>>();
/** Read-only tenant-bound model access; query methods use `service(drizzleReadModel(Model))`. */
export function drizzleReadModel<T extends object>(type: new () => T): ServiceToken<DrizzleReadModels<T>> {
    let token = tokens.get(type);
    if (!token) {
        token = serviceToken<DrizzleReadModels<object>>(`DrizzleReadModel:${type.name}`);
        tokens.set(type, token);
    }
    return token as ServiceToken<DrizzleReadModels<T>>;
}
