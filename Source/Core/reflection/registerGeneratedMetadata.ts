// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArtifactMetadata } from './ArtifactMetadata.js';
import type { ClassType } from './ClassType.js';
import type { GeneratedMetadata } from './GeneratedArtifactMetadata.js';
import { generatedMetadataSignature } from './generatedMetadataSignature.js';

const registered = new WeakMap<ClassType, ArtifactMetadata>();
/** Return the generated fallback for a decorated class. */
export function generatedMetadataFor(type: ClassType): ArtifactMetadata | undefined { return registered.get(type); }

/** Reject stale output before installing any of the generated bindings. */
export function registerGeneratedMetadata(module: GeneratedMetadata): void {
    if (module.version !== 1) throw new Error('Unsupported generated artifact metadata version; regenerate artifact metadata');
    const seen = new Set<ClassType>();
    for (const entry of module.artifacts) {
        if (seen.has(entry.type) || entry.signature !== generatedMetadataSignature(entry.type, entry.metadata))
            throw new Error(`Stale generated artifact metadata for ${entry.type.name}; regenerate artifact metadata`);
        seen.add(entry.type);
    }
    for (const entry of module.artifacts) registered.set(entry.type, entry.metadata);
}
