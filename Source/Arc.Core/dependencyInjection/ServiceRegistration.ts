// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { ServiceIdentifier } from './ServiceIdentifier.js';
import type { ServiceScope } from './ServiceScope.js';
import type { SingletonServiceContext } from './SingletonServiceContext.js';
/** Factories belong either to the registry or to an execution, never both. */
export type ServiceRegistration<T> = {
    readonly token: ServiceIdentifier<T>;
    readonly dependencies?: readonly ServiceIdentifier<unknown>[];
} & ({
    readonly lifetime: 'singleton';
    readonly factory?: (resolver: ServiceScope, context: SingletonServiceContext) => T | Promise<T>;
    /** A supplied instance is caller-owned; the registry never disposes it. */
    readonly instance?: T;
} | {
    readonly lifetime: 'scoped' | 'transient';
    readonly factory?: (resolver: ServiceScope, identity: ExecutionContext) => T | Promise<T>;
    readonly instance?: never;
});
