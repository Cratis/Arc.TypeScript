// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from './ExecutionContext.js';
import { requestContext } from './RequestContextStore.js';
import { withGeneratedMetadata } from '../reflection/registerGeneratedMetadata.js';
import type { ArtifactMetadata } from '../reflection/ArtifactMetadata.js';
import type { ClassType } from '../reflection/ClassType.js';
import type { ServiceScope } from '../dependencyInjection/ServiceScope.js';
import { withServices } from '../dependencyInjection/ServiceScope.js';
import type { ServiceRegistry } from '../dependencyInjection/ServiceRegistry.js';

/** Share server-local ambient state without changing how each caller tracks its execution. */
export function withExecutionBoundary<T>(services: ServiceRegistry, metadata: ReadonlyMap<ClassType, ArtifactMetadata> | undefined,
    scope: ServiceScope, context: ExecutionContext, callback: () => Promise<T>, borrowed = false,
    completed?: (result: T, hasLivingAncestor: boolean) => Promise<T>): Promise<T> {
    return withGeneratedMetadata(metadata, () => (borrowed
        ? services.runBorrowedExecution(() => requestContext.run(context, () => withServices(scope, callback)))
        : services.runExecution(() => requestContext.run(context, () => withServices(scope, callback)), completed)));
}
