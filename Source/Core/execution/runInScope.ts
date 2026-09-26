// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArtifactMetadata } from '../reflection/ArtifactMetadata.js';
import type { ClassType } from '../reflection/ClassType.js';
import type { ServiceRegistry } from '../dependencyInjection/ServiceRegistry.js';
import type { ServiceScope } from '../dependencyInjection/ServiceScope.js';
import { borrowedScopeAuthority } from '../dependencyInjection/ServiceScope.js';
import { ServiceDependencyError } from '../dependencyInjection/ServiceDependencyError.js';
import { withExecutionBoundary } from './withExecutionBoundary.js';
import { correlation } from './correlation.js';
import type { RunInScopeOptions } from './RunInScopeOptions.js';

/** Borrow a live scope for trusted host work; the caller remains responsible for its disposal. */
export async function runInScope<T>(services: ServiceRegistry, metadata: ReadonlyMap<ClassType, ArtifactMetadata> | undefined,
    scope: ServiceScope, callback: () => T | Promise<T>, options?: RunInScopeOptions): Promise<T> {
    const authority = borrowedScopeAuthority(scope, services);
    const override = options?.correlationId;
    if (override !== undefined && (typeof override !== 'string' || correlation(override) !== override.toLowerCase()))
        throw new ServiceDependencyError('Invalid correlation ID override');
    if (authority.signal.aborted || options?.signal?.aborted)
        throw new ServiceDependencyError('Borrowed scope signal is already aborted');
    // AbortSignal.any has no unsubscribe API; the dependent signal is collectible after this invocation settles.
    const signal = options?.signal ? AbortSignal.any([authority.signal, options.signal]) : authority.signal;
    if (signal.aborted) throw new ServiceDependencyError('Borrowed scope signal is already aborted');
    const context = Object.freeze({ ...authority, correlationId: override === undefined ? authority.correlationId : correlation(override), signal });
    return withExecutionBoundary(services, metadata, scope, context, async () => {
        const result = await callback();
        if (services.singletonFailed) throw new ServiceDependencyError('Service registry is disposed');
        return result;
    }, true);
}
