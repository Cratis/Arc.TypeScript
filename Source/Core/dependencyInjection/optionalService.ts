// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { serviceToken, type ServiceToken } from './ServiceToken.js';
import type { ServiceIdentifier } from './ServiceIdentifier.js';

const optional = new WeakMap<object, ServiceIdentifier<unknown>>();
/** Bind a nullable service to null when it is not registered. */
export function optionalService<T>(type: ServiceIdentifier<T>): ServiceToken<T | null> {
    const token = serviceToken<T | null>(`optional ${typeof type === 'function' ? type.name : type.name}`);
    optional.set(token, type);
    return token;
}
/** @internal Return the underlying service for optional bindings. */
export function optionalServiceType(token: ServiceIdentifier<unknown>): ServiceIdentifier<unknown> | undefined {
    return typeof token === 'object' ? optional.get(token) : undefined;
}
