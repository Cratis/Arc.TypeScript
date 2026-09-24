// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Fields } from '@cratis/fundamentals';
import type { ClassType } from './ClassType.js';
import type { ArtifactMetadata } from './ArtifactMetadata.js';

/** Runtime-verifiable portion of an artifact's analyzed declaration. */
export function generatedMetadataSignature(type: ClassType, metadata: ArtifactMetadata): string {
    const prototype = type.prototype as { handle?: (...parameters: never[]) => unknown; provide?: (...parameters: never[]) => unknown };
    return JSON.stringify({
        name: type.name,
        fields: Fields.getFieldsForType(type as never).map(field => [field.name, field.type.name]),
        handle: typeof prototype.handle === 'function' ? prototype.handle.length : null,
        provide: typeof prototype.provide === 'function' ? prototype.provide.length : null,
        queries: [...metadata.queryMethods?.keys() ?? []].sort().map(name => [name, (Reflect.get(type, name) as { length: number } | undefined)?.length ?? null])
    });
}
