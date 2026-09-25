// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ReadModelInterceptor, ExecutionContext } from '@cratis/arc.core';
import type { Constructor } from '@cratis/fundamentals';
import type { ChronicleArtifacts } from './ChronicleArtifacts.js';
import { ChronicleRuntime } from './ChronicleRuntime.js';
import { hasProjectedCompliance } from './hasProjectedCompliance.js';

/** Release projected Chronicle models at the query edge, within the request's tenant scope. */
export class ChronicleReadModelInterceptor implements ReadModelInterceptor {
    constructor(readonly model: Constructor<object>, private readonly runtime: ChronicleRuntime,
        private readonly context: ExecutionContext, private readonly artifacts: ChronicleArtifacts) {}

    async intercept(model: object): Promise<object> {
        if (!hasProjectedCompliance(this.model, this.artifacts)) return model;
        const store = await this.runtime.getStore(this.context);
        return store.readModels.release(this.model, model);
    }
}
