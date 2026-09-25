#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { generateClient } from './generate.js';
import { generateFromSource } from './generateFromSource.js';
import { renderGeneratedMetadata } from './renderGeneratedMetadata.js';
import { checkGeneratedMetadata } from './publishGeneratedMetadata.js';
import { parseSourceOptions } from './parseSourceOptions.js';
import { watchSource } from './watchSource.js';

const usage = 'Usage: arc-proxygenerator --project <tsconfig> --artifacts <folder> --output <folder> [--metadata <file> | --use-generated-metadata] [--check-metadata | --watch] [--root-namespace <namespace>] [--api-prefix=<prefix>] [--segments-to-skip <number>] [--skip-index-generation] [--skip-output-deletion] [--emit-interfaces]';

async function generateManifest(): Promise<void> {
    const [manifestPath, outputRoot, extra] = process.argv.slice(2);
    if (!manifestPath || !outputRoot || extra || !isAbsolute(manifestPath) || !isAbsolute(outputRoot))
        throw new Error('Usage: arc-proxygenerator <absolute-manifest.json> <existing-absolute-output-directory>');
    if ((await stat(manifestPath)).size > 4 * 1024 * 1024) throw new Error('Client manifest exceeds 4 MiB input limit');
    const source = await readFile(manifestPath, 'utf8');
    if (Buffer.byteLength(source) > 4 * 1024 * 1024) throw new Error('Client manifest exceeds 4 MiB input limit');
    const changed = await generateClient(JSON.parse(source) as unknown, outputRoot);
    process.stdout.write(`Generated ${changed.length} changed client file(s)\n`);
}

async function main(): Promise<void> {
    if (process.argv.includes('--help')) { process.stdout.write(`${usage}\n`); return; }
    if (!process.argv.slice(2).some(value => value === '--project' || value.startsWith('--project='))) {
        await generateManifest();
        return;
    }
    const { configuration, watch, checkMetadata } = parseSourceOptions(process.argv.slice(2), usage);
    if (checkMetadata) {
        if (!configuration.metadata || watch) throw new Error('--check-metadata requires --metadata and cannot watch');
        await checkGeneratedMetadata(configuration.metadata,
            renderGeneratedMetadata(configuration.project, configuration.artifacts, configuration.metadata));
        process.stdout.write('Generated artifact metadata is current (1 module)\n');
        return;
    }
    const generate = async (): Promise<void> => {
        const changed = await generateFromSource(configuration);
        process.stdout.write(`Generated ${changed.length} changed file(s)\n`);
    };
    await generate();
    if (watch) await watchSource(configuration, generate);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
