#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { generateClient } from './generate.js';

async function main(): Promise<void> {
    const [manifestPath, outputRoot, extra] = process.argv.slice(2);
    if (!manifestPath || !outputRoot || extra || !isAbsolute(manifestPath) || !isAbsolute(outputRoot))
        throw new Error('Usage: arc-proxygenerator <absolute-manifest.json> <existing-absolute-output-directory>');
    if ((await stat(manifestPath)).size > 4 * 1024 * 1024) throw new Error('Client manifest exceeds 4 MiB input limit');
    const source = await readFile(manifestPath, 'utf8');
    if (Buffer.byteLength(source) > 4 * 1024 * 1024) throw new Error('Client manifest exceeds 4 MiB input limit');
    const changed = await generateClient(JSON.parse(source) as unknown, outputRoot);
    process.stdout.write(`Generated ${changed.length} changed client file(s)\n`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
