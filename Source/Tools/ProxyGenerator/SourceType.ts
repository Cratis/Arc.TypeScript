// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
export interface SourceType {
    readonly text: string;
    readonly constructor: string;
    readonly model?: string;
    /** Namespace-qualified model identity; text and constructor retain the local class name. */
    readonly modelKey?: string;
    /** Local import name when a model name collides in the generated file. */
    readonly alias?: string;
    readonly package?: string;
    /** Set when the type is imported from a user-configured package mapping rather than generated. */
    readonly mapped?: boolean;
    readonly enumerable: boolean;
    readonly nullable: boolean;
    readonly void: boolean;
}
