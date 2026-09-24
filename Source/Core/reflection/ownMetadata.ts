// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArtifactMetadata } from './ArtifactMetadata.js';
import type { ClassType } from './ClassType.js';
import { store } from './metadataStore.js';
import { generatedMetadataFor } from './registerGeneratedMetadata.js';

/** Read Arc metadata from legacy or standard class decorators. */
export function ownMetadata(type: ClassType): ArtifactMetadata {
    const standard = Symbol.metadata && Reflect.get(type, Symbol.metadata) as object | undefined;
    const legacy = store.get(type);
    const decorated = standard && store.get(standard);
    const explicit = { ...decorated, ...legacy };
    const generated = generatedMetadataFor(type);
    if (!generated) return explicit;
    const queryMethods = new Map(generated.queryMethods);
    for (const [name, declaration] of explicit.queryMethods ?? []) {
        const inferred = queryMethods.get(name);
        queryMethods.set(name, { ...inferred, ...declaration,
            parameters: declaration.parameters ?? inferred?.parameters,
            generated: !declaration.parameters && inferred?.generated,
            observable: declaration.observableExplicit ? declaration.observable : inferred?.observable ?? declaration.observable });
    }
    const injected = new Map(generated.injected);
    for (const [name, tokens] of explicit.injected ?? []) if (tokens.length || !injected.has(name)) injected.set(name, tokens);
    const fieldOptions = new Map(generated.fieldOptions);
    for (const [name, options] of explicit.fieldOptions ?? []) fieldOptions.set(name, { ...fieldOptions.get(name), ...options });
    return { ...generated, ...explicit, queryMethods, injected, fieldOptions,
        handleParameters: explicit.injected?.get('handle')?.length ? undefined : generated.handleParameters,
        provideParameters: explicit.injected?.get('provide')?.length ? undefined : generated.provideParameters };
}
