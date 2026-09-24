#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { generateClient } from './generate.js';
import { generateFromSource, type SourceGeneratorOptions } from './generateFromSource.js';

async function main(): Promise<void> {
    if (process.argv.includes('--project')) {
        const values = process.argv.slice(2);
        const options: Record<string, string | boolean> = {};
        for (let index = 0; index < values.length; index++) {
            const key = values[index]!;
            if (!['--project', '--artifacts', '--output', '--segments-to-skip', '--api-prefix', '--skip-command-name-in-route', '--skip-query-name-in-route', '--use-proxy-file-suffix', '--js-import-specifiers'].includes(key) || key in options)
                throw new Error(`Unknown or duplicate option: ${key}`);
            if (['--skip-command-name-in-route', '--skip-query-name-in-route', '--use-proxy-file-suffix', '--js-import-specifiers'].includes(key)) options[key] = true;
            else options[key] = values[++index] ?? '';
        }
        if (typeof options['--project'] !== 'string' || typeof options['--artifacts'] !== 'string' || typeof options['--output'] !== 'string')
            throw new Error('Usage: arc-proxygenerator --project <tsconfig> --artifacts <folder> --output <folder>');
        const skip = options['--segments-to-skip'] === undefined ? 0 : Number(options['--segments-to-skip']);
        if (!Number.isSafeInteger(skip) || skip < 0) throw new Error('Invalid segments to skip');
        const configuration: SourceGeneratorOptions = {
            project: options['--project'], artifacts: options['--artifacts'], output: options['--output'], segmentsToSkip: skip,
            apiPrefix: typeof options['--api-prefix'] === 'string' ? options['--api-prefix'] : undefined,
            skipCommandNameInRoute: options['--skip-command-name-in-route'] === true,
            skipQueryNameInRoute: options['--skip-query-name-in-route'] === true,
            useProxyFileSuffix: options['--use-proxy-file-suffix'] === true,
            jsImportSpecifiers: options['--js-import-specifiers'] === true
        };
        const changed = await generateFromSource(configuration);
        process.stdout.write(`Generated ${changed.length} changed client file(s)\n`);
        return;
    }
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
