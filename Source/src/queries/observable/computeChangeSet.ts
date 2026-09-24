// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ChangeSet } from './ChangeSet.js';

function identity(item: unknown): string | undefined {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
    const keys = Object.keys(item).filter(name => name.toLowerCase() === 'id');
    if (keys.length !== 1) return undefined;
    const id: unknown = Reflect.get(item, keys[0]!);
    if (typeof id === 'string') return id.toLowerCase();
    if (typeof id === 'number' && Number.isSafeInteger(id)) return String(id);
    return undefined;
}

function identified(items: readonly unknown[]): Map<string, unknown> | undefined {
    const indexed = new Map<string, unknown>();
    for (const item of items) {
        const id = identity(item);
        if (id === undefined || indexed.has(id)) return undefined;
        indexed.set(id, item);
    }
    return indexed;
}

function byJson(previous: readonly unknown[], current: readonly unknown[]): ChangeSet<unknown> {
    const before = new Map<string, number>();
    const after = new Map<string, number>();
    const key = (item: unknown): string => JSON.stringify(item) ?? 'undefined';
    for (const item of previous) before.set(key(item), (before.get(key(item)) ?? 0) + 1);
    for (const item of current) after.set(key(item), (after.get(key(item)) ?? 0) + 1);
    const added = current.filter(item => {
        const serialized = key(item);
        const count = before.get(serialized) ?? 0;
        if (count) before.set(serialized, count - 1);
        return count === 0;
    });
    const removed = previous.filter(item => {
        const serialized = key(item);
        const count = after.get(serialized) ?? 0;
        if (count) after.set(serialized, count - 1);
        return count === 0;
    });
    return { added, replaced: [], removed };
}

/** Match identity case-insensitively; ambiguous or missing IDs use JSON multiset comparison. */
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
