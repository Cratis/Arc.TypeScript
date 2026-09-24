// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ArtifactMetadata } from './ArtifactMetadata.js';
import type { FieldOptions } from './FieldOptions.js';
import type { ClassType } from './ClassType.js';
import type { GeneratedMetadata } from './GeneratedArtifactMetadata.js';
import { generatedMetadataSignature } from './generatedMetadataSignature.js';

const registrations = new AsyncLocalStorage<ReadonlyMap<ClassType, ArtifactMetadata>>();
/** Return the builder-local generated fallback for a decorated class. */
export function generatedMetadataFor(type: ClassType): ArtifactMetadata | undefined { return registrations.getStore()?.get(type); }
/** Decoding happens after build; retain immutable field annotations for its runtime classes. */
export function generatedFieldOptionsFor(type: ClassType): Map<string, FieldOptions> | undefined {
    const current = registrations.getStore();
    return current?.get(type)?.fieldOptions;
}
/** Run a builder's registration and compilation with its own metadata. */
export function withGeneratedMetadata<T>(metadata: ReadonlyMap<ClassType, ArtifactMetadata> | undefined, action: () => T): T {
    return registrations.run(metadata ?? new Map(), action);
}
/** Reject stale output before returning a builder-local registration map. */
export function registerGeneratedMetadata(module: GeneratedMetadata): ReadonlyMap<ClassType, ArtifactMetadata> {
    if (module.version !== 1) throw new Error('Unsupported generated artifact metadata version; regenerate artifact metadata');
    const seen = new Set<ClassType>();
    for (const entry of module.artifacts) {
        if (seen.has(entry.type) || entry.signature !== generatedMetadataSignature(entry.type, entry.metadata))
            throw new Error(`Stale generated artifact metadata for ${entry.type.name}; regenerate artifact metadata`);
        seen.add(entry.type);
    }
    return new Map(module.artifacts.map(entry => [entry.type, entry.metadata]));
}
