// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Fields } from '@cratis/fundamentals';
import type { ClassType } from './ClassType.js';
import type { ArtifactMetadata } from './ArtifactMetadata.js';

/** Canonical runtime-verifiable portion of an artifact declaration for the source generator. */
export function canonicalMetadataSignature(name: string, fields: readonly (readonly [string, string])[], handle: number | null,
    provide: number | null, queries: readonly (readonly [string, number | null])[]): string {
    return JSON.stringify({ name, fields, handle, provide, queries: [...queries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0) });
}
/** @internal Runtime-verifiable portion of an artifact's analyzed declaration. */
export function generatedMetadataSignature(type: ClassType, metadata: ArtifactMetadata): string {
    const prototype = type.prototype as { handle?: (...parameters: never[]) => unknown; provide?: (...parameters: never[]) => unknown };
    return canonicalMetadataSignature(type.name, Fields.getFieldsForType(type as never).map(field => [field.name, field.type.name]),
        typeof prototype.handle === 'function' ? prototype.handle.length : null,
        typeof prototype.provide === 'function' ? prototype.provide.length : null,
        [...metadata.queryMethods?.keys() ?? []].map(name => [name, (Reflect.get(type, name) as { length: number } | undefined)?.length ?? null]));
}
