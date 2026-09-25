// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Primitive stored by a Drizzle concept column. */
export enum ConceptCodecKind {
    /** A UUID-backed concept. */
    Guid = 'guid',
    /** A number-backed concept. */
    Number = 'number',
    /** A string-backed concept. */
    String = 'string'
}
