// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { serviceToken, type ServiceToken } from './ServiceToken.js';

export type ServiceClass<T> = abstract new (...arguments_: never[]) => T;
export type ServiceIdentifier<T> = ServiceToken<T> | ServiceClass<T>;
const classTokens = new WeakMap<ServiceClass<unknown>, ServiceToken<unknown>>();
export function normalizeServiceToken<T>(identifier: ServiceIdentifier<T>): ServiceToken<T> {
    if (typeof identifier !== 'function') return identifier;
    let token = classTokens.get(identifier);
    if (!token) {
        token = serviceToken(identifier.name);
        classTokens.set(identifier, token);
    }
    return token as ServiceToken<T>;
}
