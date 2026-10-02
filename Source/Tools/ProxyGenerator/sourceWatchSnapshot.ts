// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** Capture source identities, including new and removed files, without reading generated output. */
export async function sourceWatchSnapshot(root: string, externalFiles: ReadonlySet<string>,
    excluded: (path: string) => boolean): Promise<Map<string, string>> {
    const snapshot = new Map<string, string>();
    const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
    const capture = async (file: string) => {
        try {
            const current = await stat(file, { bigint: true });
            // ctime catches preserved mtimes; inode catches atomic editor saves, even with equal sizes/timestamps.
            snapshot.set(file, `${current.mtimeNs}:${current.ctimeNs}:${current.size}:${current.ino}`);
        } catch (error) { if (!missing(error)) throw error; }
    };
    const visit = async (directory: string): Promise<void> => {
        const entries = await readdir(directory, { withFileTypes: true }).catch(error => {
            if (missing(error)) return [];
            throw error;
        });
        for (const entry of entries) {
            const path = join(directory, entry.name);
            if (excluded(path) || entry.name === 'node_modules' || entry.name === '.git') continue;
            if (entry.isDirectory()) await visit(path);
            else if (path.endsWith('.ts') && !path.endsWith('.d.ts')) await capture(path);
        }
    };
    await visit(root);
    for (const file of externalFiles) await capture(file);
    return snapshot;
}
