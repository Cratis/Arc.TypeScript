// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArtifactMetadata } from '../reflection/ArtifactMetadata.js';
import type { ClassType } from '../reflection/ClassType.js';
import type { ServiceRegistry } from '../dependencyInjection/ServiceRegistry.js';
import type { ServiceScope } from '../dependencyInjection/ServiceScope.js';
import { borrowedScopeAuthority } from '../dependencyInjection/ServiceScope.js';
import { ServiceDependencyError } from '../dependencyInjection/ServiceDependencyError.js';
import { withExecutionBoundary } from './withExecutionBoundary.js';

/** Borrow a live scope for trusted host work; the caller remains responsible for its disposal. */
export async function runInScope<T>(services: ServiceRegistry, metadata: ReadonlyMap<ClassType, ArtifactMetadata> | undefined,
    scope: ServiceScope, callback: () => T | Promise<T>, options?: { correlationId?: string; signal?: AbortSignal }): Promise<T> {
    const authority = borrowedScopeAuthority(scope, services);
    const context = Object.freeze({ ...authority, correlationId: options?.correlationId ?? authority.correlationId,
        signal: options?.signal ? AbortSignal.any([authority.signal, options.signal]) : authority.signal });
    return withExecutionBoundary(services, metadata, scope, context, async () => {
        const result = await callback();
        if (services.singletonFailed) throw new ServiceDependencyError('Service registry is disposed');
        return result;
    }, true);
}
