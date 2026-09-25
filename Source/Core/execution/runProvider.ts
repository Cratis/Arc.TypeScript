// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from './ExecutionContext.js';
import type { ServiceRegistry } from '../dependencyInjection/ServiceRegistry.js';
import type { ClassType } from '../reflection/ClassType.js';
import type { ArtifactMetadata } from '../reflection/ArtifactMetadata.js';
import { runOwned } from './runOwned.js';

/** Resolve a provider and propagate both provider and cleanup failures. */
export async function runProvider<T>(services: ServiceRegistry, metadata: ReadonlyMap<ClassType, ArtifactMetadata> | undefined,
    context: ExecutionContext, callback: () => T | Promise<T>): Promise<T> {
    type Outcome = { failed: false; value: T } | { failed: true; error: unknown };
    const outcome = await runOwned<Outcome>(services, metadata, context, async () => {
        try { return { failed: false, value: await callback() }; }
        catch (error) { return { failed: true, error }; }
    }, value => !value.failed, (error, previous) => ({ failed: true, error: previous?.failed
        ? new AggregateError([previous.error, error], 'Provider and cleanup failed') : error }));
    if (outcome.failed) throw outcome.error;
    return outcome.value;
}
