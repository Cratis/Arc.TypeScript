// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ReadModelInterceptor, ExecutionContext, RawReadModelProvenance } from '@cratis/arc.core';
import type { Constructor } from '@cratis/fundamentals';
import { ChronicleRuntime } from './ChronicleRuntime.js';
import { ReadModelSubjectResolver } from '@cratis/chronicle/readModels';
import { hasProtectedReadModel, holdsProtectedValues } from './hasProtectedReadModel.js';
import { isKernelReleased, markKernelReleased } from './kernelReleasedReadModels.js';
import { releaseRawDocument } from './releaseRawDocument.js';

/** Release protected Chronicle models read outside the kernel, within the request's tenant scope. */
export class ChronicleReadModelInterceptor implements ReadModelInterceptor {
    constructor(readonly model: Constructor<object>, private readonly runtime: ChronicleRuntime,
        private readonly context: ExecutionContext) {}

    /**
     * Release through Chronicle, which needs the model's `@subject()` or `id`. An instance without a subject, such as
     * a masked copy that dropped its `id`, is served only when it holds no value in a protected property.
     */
    async intercept(model: object): Promise<object> {
        if (!hasProtectedReadModel(this.model) || isKernelReleased(model)) return model;
        if (ReadModelSubjectResolver.resolveFrom(this.model, model) === undefined) {
            if (holdsProtectedValues(this.model, model))
                throw new Error(`Cannot release a ${this.model.name} without a subject: keep its @subject() property ` +
                    'or id, or clear its protected values');
            return markKernelReleased(model);
        }
        const store = await this.runtime.getStore(this.context);
        return markKernelReleased(await store.readModels.release(this.model, model));
    }

    /** Nested instances are safe only when Chronicle released them or the model holds no protected data. */
    isReleased(model: object): boolean {
        return !hasProtectedReadModel(this.model) || isKernelReleased(model);
    }

    /**
     * Release a raw storage document explicitly marked as this model, for its declared tenant and subject. Always
     * returns a new object built from Chronicle's released values; the stored document is never served.
     */
    async interceptRawDocument(document: object, provenance: RawReadModelProvenance): Promise<object> {
        if (provenance.model !== this.model) throw new Error(`Raw document is not a ${this.model.name}`);
        if (!this.context.tenantId || provenance.tenantId !== this.context.tenantId)
            throw new Error(`Raw ${this.model.name} document belongs to another tenant`);
        return markKernelReleased(
            await releaseRawDocument(this.model, document, provenance.subject, await this.runtime.getStore(this.context)));
    }
}
