// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArtifactMetadata } from './ArtifactMetadata.js';
import { store } from './metadataStore.js';

/** Read or create Arc metadata for a decorated declaration. */
export function metadataFor(target: object): ArtifactMetadata {
    let value = store.get(target);
    if (!value) { value = {}; store.set(target, value); }
    return value;
}
