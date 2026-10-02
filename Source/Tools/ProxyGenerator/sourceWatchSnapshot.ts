// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { join } from 'node:path';
import { SourceWatchReader } from './SourceWatchReader.js';
import type { SourceWatchEntry } from './SourceWatchEntry.js';

/** Capture source identities in bounded batches, without statting directories or generated output. */
export async function sourceWatchSnapshot(root: string, externalFiles: ReadonlySet<string>,
    excluded: (path: string) => boolean, reader = new SourceWatchReader(root)): Promise<Map<string, SourceWatchEntry>> {
    const snapshot = new Map<string, SourceWatchEntry>();
    const files = new Set(externalFiles);
    const directories = [root];
    for (let index = 0; index < directories.length;) {
        const batch = directories.slice(index, index + 32);
        index += batch.length;
        await Promise.all(batch.map(async directory => {
            for (const entry of await reader.directory(directory)) {
                const path = join(directory, entry.name);
                if (excluded(path) || entry.name === 'node_modules' || entry.name === '.git') continue;
                if (entry.isDirectory()) directories.push(path);
                else if (path.endsWith('.ts') && !path.endsWith('.d.ts')) files.add(path);
            }
        }));
    }
    // A shared iterator bounds both in-flight stats and promise allocation for large trees.
    const remaining = files.values();
    await Promise.all(Array.from({ length: Math.min(32, files.size) }, async () => {
        for (let item = remaining.next(); !item.done; item = remaining.next()) {
            const entry = await reader.file(item.value);
            if (entry) snapshot.set(item.value, entry);
        }
    }));
    return snapshot;
}
