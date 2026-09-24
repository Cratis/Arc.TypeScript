// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Snapshot an observable value without renaming property keys before computing changes. */
export function stringifyNamedFloats(value: unknown): string {
    return JSON.stringify(value, (_key: string, member: unknown) =>
        typeof member === 'number' && !Number.isFinite(member) ? String(member) : member);
}

/** Preserve arbitrary dictionary and schema keys; field-declared models are named by encode(). */
export function stringifyWire(value: unknown): string {
    return stringifyNamedFloats(value);
}
