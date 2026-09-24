// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from './ExecutionContext.js';
import type { ServiceToken } from './ServiceToken.js';
import type { ServiceScope } from './ServiceScope.js';
import type { ServiceLifetime } from './ServiceLifetime.js';
export interface ServiceRegistration<T> {
    readonly token: ServiceToken<T>;
    readonly lifetime: ServiceLifetime;
    readonly dependencies?: readonly ServiceToken<unknown>[];
    readonly factory?: (resolver: ServiceScope, identity: ExecutionContext) => T | Promise<T>;
    /** A supplied instance is caller-owned; the registry never disposes it. */
    readonly instance?: T;
}
