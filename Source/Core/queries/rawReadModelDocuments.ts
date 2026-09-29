// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from '../reflection/ClassType.js';

/** Where a raw storage document came from: its declared read-model type, tenant, and compliance subject. */
export interface RawReadModelProvenance {
    readonly model: ClassType;
    readonly tenantId: string;
    readonly subject: string;
}

// Shared through the global symbol registry so duplicate installs of Arc core still agree on provenance.
const registryKey = Symbol.for('@cratis/arc.core/rawReadModelDocuments');
const registry: WeakMap<object, RawReadModelProvenance> = (globalThis as Record<symbol, unknown>)[registryKey] as
    WeakMap<object, RawReadModelProvenance> | undefined ?? new WeakMap();
(globalThis as Record<symbol, unknown>)[registryKey] = registry;

/** Declare that an untyped storage document holds data of an explicitly named read model. */
export function markRawReadModelDocument<T extends object>(document: T, provenance: RawReadModelProvenance): T {
    if (document === null || typeof document !== 'object') throw new TypeError('A raw read-model document must be an object');
    if (!provenance.tenantId) throw new Error('A raw read-model document requires a tenant');
    if (!provenance.subject) throw new Error('A raw read-model document requires a subject');
    registry.set(document, Object.freeze({ ...provenance }));
    return document;
}

/** Read the provenance recorded for this exact document instance, if any. */
export function rawReadModelProvenance(document: object): RawReadModelProvenance | undefined {
    return registry.get(document);
}

/** Forget the provenance of a document an interceptor has handled, so it is served as that interceptor returned it. */
export function forgetRawReadModelDocument(document: object): void {
    registry.delete(document);
}
