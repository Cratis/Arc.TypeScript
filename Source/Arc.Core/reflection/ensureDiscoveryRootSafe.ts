// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { realpath } from 'node:fs/promises';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Avoid re-importing a suspended bootstrap, including one imported by the entry script. */
export async function ensureDiscoveryRootSafe(folder: string): Promise<void> {
    const frames = new Error().stack?.split('\n').slice(1) ?? [];
    const paths = [process.argv[1], ...frames.map(frame => {
        const source = frame.match(/(?:file:\/\/\/|\/)[^()\s]+?\.[cm]?[jt]s(?=:\d+:\d+|\)|\s|$)/)?.[0];
        return source?.startsWith('file:') ? fileURLToPath(source) : source;
    })].filter((path): path is string => !!path);
    for (const path of paths) {
        const resolved = await realpath(path).catch(() => undefined);
        if (resolved && (resolved === folder || resolved.startsWith(folder + sep))) {
            throw new Error('Arc discovery cannot import the bootstrap folder');
        }
    }
}
