// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArtifactMetadata } from './ArtifactMetadata.js';
import type { ClassType } from './ClassType.js';
import { store } from './metadataStore.js';

/** Read Arc metadata from legacy or standard class decorators. */
export function ownMetadata(type: ClassType): ArtifactMetadata {
    const standard = Symbol.metadata && Reflect.get(type, Symbol.metadata) as object | undefined;
    const legacy = store.get(type);
    const decorated = standard && store.get(standard);
    if (!legacy) return decorated ?? {};
    if (!decorated) return legacy;
    return { ...decorated, ...legacy };
}
