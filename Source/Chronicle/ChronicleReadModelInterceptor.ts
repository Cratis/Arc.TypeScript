// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ReadModelInterceptor, ExecutionContext } from '@cratis/arc.core';
import type { Constructor } from '@cratis/fundamentals';
import { ChronicleRuntime } from './ChronicleRuntime.js';
import { hasProtectedReadModel } from './hasProtectedReadModel.js';
import { isKernelReleased } from './kernelReleasedReadModels.js';

/** Release protected Chronicle models read outside the kernel, within the request's tenant scope. */
export class ChronicleReadModelInterceptor implements ReadModelInterceptor {
    constructor(readonly model: Constructor<object>, private readonly runtime: ChronicleRuntime,
        private readonly context: ExecutionContext) {}

    async intercept(model: object): Promise<object> {
        if (!hasProtectedReadModel(this.model) || isKernelReleased(model)) return model;
        const store = await this.runtime.getStore(this.context);
        return store.readModels.release(this.model, model);
    }
}
