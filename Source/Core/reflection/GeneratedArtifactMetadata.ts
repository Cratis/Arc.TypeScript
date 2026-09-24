// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from './ClassType.js';
import type { ArtifactMetadata } from './ArtifactMetadata.js';

/** An analyzed artifact and the runtime shape used to reject stale generated output. */
export interface GeneratedArtifactMetadata {
    readonly type: ClassType;
    readonly metadata: ArtifactMetadata;
    readonly signature: string;
}

/** Metadata produced by the source analyzer for an artifacts root. */
export interface GeneratedMetadata {
    readonly version: 1;
    readonly artifacts: readonly GeneratedArtifactMetadata[];
}
