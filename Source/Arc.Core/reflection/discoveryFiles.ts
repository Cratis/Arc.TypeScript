// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

/** Enumerate the files Arc discovers, without following symlinks or importing application code. */
export function discoveryFiles(folder: string): string[] {
    const files: string[] = [];
    const walk = (directory: string): void => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (entry.isSymbolicLink()) continue;
            const path = join(directory, entry.name);
            if (entry.isDirectory()) {
                if (!['dist', 'node_modules', 'given'].includes(entry.name) && !entry.name.startsWith('for_')) walk(path);
            } else if (entry.isFile() && /\.(?:js|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts') &&
                !/^index\.[jt]s$/.test(entry.name)) files.push(path);
        }
    };
    walk(folder);
    files.sort();
    const seen = new Set(files.map(file => file.slice(0, -extname(file).length)));
    if (seen.size !== files.length || new Set(files.map(extname)).size > 1)
        throw new Error('Arc discovery cannot mix emitted JS and TS files');
    return files;
}
