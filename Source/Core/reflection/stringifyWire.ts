// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { wireName } from './wireSchema.js';

/** Snapshot an observable value without renaming property keys before computing changes. */
export function stringifyNamedFloats(value: unknown): string {
    return JSON.stringify(value, (_key: string, member: unknown) =>
        typeof member === 'number' && !Number.isFinite(member) ? String(member) : member);
}

/** Apply Arc's named-float and acronym-friendly property policies only at the transport. */
export function stringifyWire(value: unknown): string {
    const copies = new WeakMap<object, object>();
    return JSON.stringify(value, (_name: string, member: unknown) => {
        if (typeof member === 'number' && !Number.isFinite(member)) return String(member);
        if (!member || typeof member !== 'object' || Array.isArray(member)) return member;
        if (copies.has(member)) return copies.get(member);
        const entries = Object.entries(member).map(([name, item]) => [wireName(name), item] as const);
        if (new Set(entries.map(([name]) => name)).size !== entries.length)
            throw new Error('Ambiguous Arc wire property names');
        const copy = Object.fromEntries(entries);
        copies.set(member, copy);
        copies.set(copy, copy);
        return copy;
    });
}
