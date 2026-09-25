// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from './ExecutionContext.js';
import { requestContext } from './RequestContextStore.js';
import { withGeneratedMetadata } from '../reflection/registerGeneratedMetadata.js';
import type { ArtifactMetadata } from '../reflection/ArtifactMetadata.js';
import type { ClassType } from '../reflection/ClassType.js';
import type { ServiceRegistry } from '../dependencyInjection/ServiceRegistry.js';
import { withServices } from '../dependencyInjection/ServiceScope.js';

/** Run an operation and its service cleanup in the same execution boundary. */
export function runOwned<T>(services: ServiceRegistry, metadata: ReadonlyMap<ClassType, ArtifactMetadata> | undefined,
    context: ExecutionContext, callback: () => T | Promise<T>, isSuccess: (value: T) => boolean,
    fail: (error: unknown, previous?: T) => T): Promise<T> {
    const scope = services.createScope(context);
    return withGeneratedMetadata(metadata, () => services.runExecution(() => requestContext.run(context, () => withServices(scope, async () => {
        let result: T;
        try { result = await callback(); }
        catch (error) { result = fail(error); }
        try { await scope.dispose(); }
        catch (error) { result = fail(error, result); }
        if (isSuccess(result) && services.singletonFailed)
            result = fail(new Error('Service registry is disposed'), result);
        return result;
    })), async (initial, hasLivingAncestor) => {
        let result = initial;
        const checkAvailability = (): void => {
            if (isSuccess(result) && services.singletonFailed)
                result = fail(new Error('Service registry is disposed'), result);
        };
        checkAvailability();
        if (services.singletonFailed && !hasLivingAncestor) {
            try { await services.dispose(); }
            catch (error) { result = fail(error, result); }
        }
        checkAvailability();
        return result;
    }));
}
