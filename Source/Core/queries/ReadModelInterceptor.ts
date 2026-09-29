// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from '../reflection/ClassType.js';
import type { RawReadModelProvenance } from './rawReadModelDocuments.js';

/** Scoped transformation for instances of one exact read-model type, before wire encoding. */
export interface ReadModelInterceptor<T extends object = object> {
    readonly model: ClassType<T>;
    intercept(model: T): T | Promise<T>;
    /**
     * Transform an untyped storage document explicitly marked as this model. Interceptors that omit it make
     * Arc fail the query rather than serve such a document untransformed. Arc serves whatever the interceptors
     * return, so returning the input serves the stored document as is. Arc never clears a document's mark: only
     * the value returned for this result is trusted, and a document emitted again is intercepted again.
     */
    interceptRawDocument?(document: object, provenance: RawReadModelProvenance): object | Promise<object>;
    /**
     * Opt in to protecting this model wherever it appears. When present, every exact-type instance in a result,
     * including the values `intercept` returned for the top-level, array and page slots, is served only if this
     * returns true; otherwise Arc fails the query. It must therefore return true for anything this interceptor's
     * `intercept` returns. Interceptors that omit it do not protect nested instances: those are served as they
     * are, untransformed.
     */
    isReleased?(model: T): boolean;
}
