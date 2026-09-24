// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { serviceToken, type ServiceToken } from '../../dependencyInjection/ServiceToken.js';
import type { ServiceClass } from '../../dependencyInjection/ServiceIdentifier.js';
const types = new WeakMap<object, ServiceClass<unknown>>();
const providedBrand: unique symbol = Symbol('Arc provided argument');
/** A typed method binding to a value returned by provide(). */
export type ProvidedToken<T> = ServiceToken<T> & { readonly [providedBrand]: true };
/** Bind a handle parameter to a value returned from provide() by runtime type. */
export function provided<T>(type: ServiceClass<T>): ProvidedToken<T> {
    const token = serviceToken<T>(`provided ${type.name}`) as ProvidedToken<T>;
    types.set(token, type);
    return token;
}
/** Runtime type associated with an explicit provided-value binding. */
export function providedType(token: unknown): ServiceClass<unknown> | undefined {
    return token && typeof token === 'object' ? types.get(token) : undefined;
}
