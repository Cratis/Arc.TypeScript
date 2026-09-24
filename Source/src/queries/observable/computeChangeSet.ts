// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ChangeSet } from './ChangeSet.js';

type Identity = string | number | boolean;

function identity(item: unknown): Identity | undefined {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
    const keys = Object.keys(item).filter(name => name.toLowerCase() === 'id');
    if (keys.length !== 1) return undefined;
    const id: unknown = Reflect.get(item, keys[0]!);
    if (typeof id === 'string' || typeof id === 'boolean') return id;
    if (typeof id === 'number' && Number.isFinite(id) && Number.isSafeInteger(Math.trunc(id))) return id;
    return undefined;
}

function identified(items: readonly unknown[]): Map<Identity, unknown> | undefined {
    const indexed = new Map<Identity, unknown>();
    for (const item of items) {
        const id = identity(item);
        if (id === undefined || indexed.has(id)) return undefined;
        indexed.set(id, item);
    }
    return indexed;
}

function byJson(previous: readonly unknown[], current: readonly unknown[]): ChangeSet<unknown> {
    const key = (item: unknown): string => JSON.stringify(item) ?? 'undefined';
    const before = new Set(previous.map(key));
    const after = new Set(current.map(key));
    const added = current.filter(item => !before.has(key(item)));
    const removed = previous.filter(item => !after.has(key(item)));
    return { added, replaced: [], removed };
}

/** Discover the id property case-insensitively; compare identity values by type and case. */
export function computeChangeSet(previous: readonly unknown[], current: readonly unknown[]): ChangeSet<unknown> {
    const old = identified(previous);
    const next = identified(current);
    if (!old || !next) return byJson(previous, current);
    const added: unknown[] = [];
    const replaced: unknown[] = [];
    const removed: unknown[] = [];
    for (const [id, item] of next) {
        if (!old.has(id)) added.push(item);
        else if (JSON.stringify(old.get(id)) !== JSON.stringify(item)) replaced.push(item);
    }
    for (const [id, item] of old) if (!next.has(id)) removed.push(item);
    return { added, replaced, removed };
}
