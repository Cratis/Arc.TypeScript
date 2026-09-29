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
     * Arc fail the query rather than serve such a document untransformed. Return a new object; Arc clears the
     * input's mark once the interceptors have run and serves whatever they return, so returning the input serves
     * the stored document as is.
     */
    interceptRawDocument?(document: object, provenance: RawReadModelProvenance): object | Promise<object>;
    /**
     * Whether an instance found nested inside a returned shape (outside the top-level, array and page slots Arc
     * intercepts) is already safe to serve. Interceptors that omit it make Arc fail the query for such instances.
     */
    isReleased?(model: T): boolean;
}
