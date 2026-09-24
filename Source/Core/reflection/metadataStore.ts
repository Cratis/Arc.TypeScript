// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArtifactMetadata } from './ArtifactMetadata.js';

const registryKey = Symbol.for('@cratis/arc.core/modelBound/metadata');
export const store = (globalThis as typeof globalThis & { [registryKey]?: WeakMap<object, ArtifactMetadata> })[registryKey] ??=
    new WeakMap<object, ArtifactMetadata>();
