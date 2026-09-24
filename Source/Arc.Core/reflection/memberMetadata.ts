// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArtifactMetadata } from './ArtifactMetadata.js';
import { metadataFor } from './metadataFor.js';

/** Store a method or field declaration on its owning class. */
export function memberMetadata(target: object, _name: string, context?: { metadata?: DecoratorMetadataObject }): ArtifactMetadata {
    const owner = context ? context.metadata ?? target : typeof target === 'function' ? target : target.constructor;
    return metadataFor(owner);
}
