#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readFile, stat, watch } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { generateClient } from './generate.js';
import { generateFromSource, type SourceGeneratorOptions } from './generateFromSource.js';
import { renderGeneratedMetadata } from './renderGeneratedMetadata.js';
import { checkGeneratedMetadata } from './publishGeneratedMetadata.js';

async function main(): Promise<void> {
    const usage = 'Usage: arc-proxygenerator --project <tsconfig> --artifacts <folder> --output <folder> [--metadata <file>] [--check-metadata | --watch] [--root-namespace <namespace>] [--api-prefix=<prefix>] [--segments-to-skip <number>] [--skip-index-generation] [--skip-output-deletion] [--emit-interfaces]';
    if (process.argv.includes('--help')) { process.stdout.write(`${usage}\n`); return; }
    if (process.argv.slice(2).some(value => value === '--project' || value.startsWith('--project='))) {
        const values = process.argv.slice(2);
        const options: Record<string, string | boolean> = {};
        const flags = ['--skip-command-name-in-route', '--skip-query-name-in-route', '--use-proxy-file-suffix', '--js-import-specifiers', '--skip-index-generation', '--skip-output-deletion', '--emit-interfaces', '--watch', '--check-metadata'];
        const arguments_ = ['--project', '--artifacts', '--output', '--metadata', '--segments-to-skip', '--api-prefix', '--root-namespace'];
        for (let index = 0; index < values.length; index++) {
            const [key, attached] = values[index]!.split(/=(.*)/s, 2);
            if ((!flags.includes(key!) && !arguments_.includes(key!)) || key! in options || flags.includes(key!) && attached !== undefined)
                throw new Error(`Unknown or duplicate option: ${values[index]}`);
            if (flags.includes(key!)) options[key!] = true;
            else {
                const value = attached ?? values[++index];
                if (value === undefined || value === '' || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
                options[key!] = value;
            }
        }
        if (typeof options['--project'] !== 'string' || typeof options['--artifacts'] !== 'string' || typeof options['--output'] !== 'string')
            throw new Error(usage);
        const skip = options['--segments-to-skip'] === undefined ? 0 : Number(options['--segments-to-skip']);
        if (!Number.isSafeInteger(skip) || skip < 0) throw new Error('Invalid segments to skip');
        const configuration: SourceGeneratorOptions = {
            project: options['--project'], artifacts: options['--artifacts'], output: options['--output'], segmentsToSkip: skip,
            metadata: typeof options['--metadata'] === 'string' ? options['--metadata'] : undefined,
            apiPrefix: typeof options['--api-prefix'] === 'string' ? options['--api-prefix'] : undefined,
            skipCommandNameInRoute: options['--skip-command-name-in-route'] === true,
            skipQueryNameInRoute: options['--skip-query-name-in-route'] === true,
            useProxyFileSuffix: options['--use-proxy-file-suffix'] === true,
            jsImportSpecifiers: options['--js-import-specifiers'] === true,
            rootNamespace: typeof options['--root-namespace'] === 'string' ? options['--root-namespace'] : undefined,
            skipIndexGeneration: options['--skip-index-generation'] === true,
            skipOutputDeletion: options['--skip-output-deletion'] === true,
            emitInterfaces: options['--emit-interfaces'] === true
        };
        if (options['--check-metadata']) {
            if (!configuration.metadata || options['--watch']) throw new Error('--check-metadata requires --metadata and cannot watch');
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
        if (options['--watch']) {
            let pending: Promise<void> = Promise.resolve();
            for await (const event of watch(configuration.artifacts, { recursive: true })) {
                if (!event.filename || event.filename.endsWith('.tmp') ||
                    configuration.metadata && event.filename.endsWith(configuration.metadata.split('/').at(-1)!)) continue;
                pending = pending.then(generate).catch(error => { console.error(error); process.exitCode = 1; });
            }
            await pending;
        }
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
