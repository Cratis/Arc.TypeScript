// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { watch, type FSWatcher } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { basename, dirname, resolve, sep } from 'node:path';
import type ts from 'typescript';
import { sourceProgram } from './sourceProgram.js';
import { analyzeSource } from './analyzeSource.js';
import { isColocatedOutput } from './isColocatedOutput.js';
import { sourceWatchSnapshot } from './sourceWatchSnapshot.js';
import type { SourceGeneratorOptions } from './generateFromSource.js';

async function canonicalPath(path: string): Promise<string> {
    const absolute = resolve(path);
    try { return await realpath(absolute); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return resolve(await realpath(dirname(absolute)), basename(absolute));
    }
}

async function externalFiles(root: string, outputRoot: string, metadata: string | undefined,
    separateOutput: boolean, program: ts.Program): Promise<string[]> {
    const files = await Promise.all(program.getSourceFiles()
        .filter(file => !file.isDeclarationFile && !file.fileName.includes(`${sep}node_modules${sep}`))
        .map(file => canonicalPath(file.fileName)));
    return files.filter(file => file !== metadata && !file.endsWith('.proxy.ts') &&
        !file.startsWith(root + sep) && !(separateOutput && file.startsWith(outputRoot + sep)));
}

/** Regenerate on changes in artifacts or in external source dependencies. */
export async function watchSource(configuration: SourceGeneratorOptions, generate: () => Promise<void>): Promise<void> {
    const root = await realpath(configuration.artifacts);
    const metadata = configuration.metadata && await canonicalPath(configuration.metadata);
    const outputRoot = await realpath(configuration.output);
    const program = sourceProgram(configuration.project);
    const analysis = analyzeSource(configuration.project, root, configuration.rootNamespace,
        !!configuration.metadata || configuration.generatedMetadata === true, program, undefined, undefined, configuration.typeMappings);
    const separateOutput = !(await isColocatedOutput(root, outputRoot, analysis));
    const watched = new Set(await externalFiles(root, outputRoot, metadata, separateOutput, program));
    let timer: NodeJS.Timeout | undefined, pending: Promise<void> = Promise.resolve();
    const schedule = () => {
        if (timer) clearTimeout(timer);
        else process.stdout.write('Watch change detected\n');
        timer = setTimeout(() => {
            timer = undefined;
            pending = pending.then(generate).catch(error => { console.error(error); process.exitCode = 1; });
        }, 150);
    };
    const snapshot = () => sourceWatchSnapshot(root, watched, path => path === metadata || path.endsWith('.proxy.ts') ||
        separateOutput && (path === outputRoot || path.startsWith(outputRoot + sep)));
    // Establish the polling baseline before announcing readiness, not on the first asynchronous poll.
    let previous = await snapshot();
    let polling: NodeJS.Timeout | undefined, checking: Promise<void> | undefined;
    const watchers: FSWatcher[] = [];
    try {
        await new Promise<void>((_, reject) => {
            const check = () => {
                // Native notifications and polling reconcile the same snapshot. Late/coalesced notifications
                // must not regenerate twice, and a slow scan must not build up a queue of overlapping scans.
                checking ??= snapshot().then(current => {
                    if (current.size !== previous.size || [...current].some(([file, state]) => previous.get(file) !== state)) {
                        previous = current;
                        schedule();
                    }
                }).catch(reject).finally(() => { checking = undefined; });
            };
            watchers.push(watch(root, { recursive: true }, check).on('error', reject));
            for (const directory of new Set([...watched].map(dirname)))
                watchers.push(watch(directory, check).on('error', reject));
            // FSEvents can omit artifact-directory notifications entirely. Scan the tree as well as
            // external dependencies so additions, removals and atomic replacements also recover.
            polling = setInterval(check, 250);
            process.stdout.write(`Watching artifact sources (${watchers.length} directories)\nWatch ready\n`);
        });
    } finally {
        if (polling) clearInterval(polling);
        for (const watcher of watchers) watcher.close();
        await checking;
        if (timer) clearTimeout(timer);
        await pending;
    }
}
