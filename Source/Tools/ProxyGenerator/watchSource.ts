// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { watch, type FSWatcher } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { basename, dirname, resolve, sep } from 'node:path';
import type ts from 'typescript';
import { sourceProgram } from './sourceProgram.js';
import { analyzeSource } from './analyzeSource.js';
import { isColocatedOutput } from './isColocatedOutput.js';
import { SourceWatchMonitor } from './SourceWatchMonitor.js';
import { SourceWatchReader } from './SourceWatchReader.js';
import { watchPollInterval } from './watchPollInterval.js';
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
    separateOutput: boolean, program: ts.Program, reader: SourceWatchReader): Promise<string[]> {
    const files = await Promise.all(program.getSourceFiles()
        .filter(file => !file.isDeclarationFile && !file.fileName.includes(`${sep}node_modules${sep}`))
        .map(file => canonicalPath(file.fileName).catch(error => {
            reader.skipped(file.fileName, error);
            return resolve(file.fileName);
        })));
    return files.filter(file => file !== metadata && !file.endsWith('.proxy.ts') &&
        !file.startsWith(root + sep) && !(separateOutput && file.startsWith(outputRoot + sep)));
}

/** Regenerate on changes in artifacts or in external source dependencies. */
export async function watchSource(configuration: SourceGeneratorOptions, generate: () => Promise<void>): Promise<void> {
    const interval = watchPollInterval(configuration.watchPollInterval);
    const root = await realpath(configuration.artifacts);
    const reader = new SourceWatchReader(root);
    const metadata = configuration.metadata && await canonicalPath(configuration.metadata);
    const outputRoot = await realpath(configuration.output);
    const program = sourceProgram(configuration.project);
    const analysis = analyzeSource(configuration.project, root, configuration.rootNamespace,
        !!configuration.metadata || configuration.generatedMetadata === true, program, undefined, undefined, configuration.typeMappings);
    const separateOutput = !(await isColocatedOutput(root, outputRoot, analysis));
    const watched = new Set(await externalFiles(root, outputRoot, metadata, separateOutput, program, reader));
    let timer: NodeJS.Timeout | undefined, pending: Promise<void> = Promise.resolve();
    const schedule = () => {
        if (timer) clearTimeout(timer);
        else process.stdout.write('Watch change detected\n');
        timer = setTimeout(() => {
            timer = undefined;
            pending = pending.then(generate).catch(error => { console.error(error); process.exitCode = 1; });
        }, 150);
    };
    const excluded = (path: string) => path === metadata || path.endsWith('.proxy.ts') ||
        separateOutput && (path === outputRoot || path.startsWith(outputRoot + sep));
    let rejectWatch!: (error: unknown) => void;
    const failure = new Promise<void>((_, reject) => { rejectWatch = reject; });
    const monitor = new SourceWatchMonitor(root, watched, excluded, interval, schedule, rejectWatch, reader);
    const watchers: FSWatcher[] = [];
    try {
        // Finish the initial checkpoint before readiness, even when periodic reconciliation is disabled.
        await monitor.start();
        watchers.push(watch(root, { recursive: true }, (_, filename) => {
            if (filename) void monitor.notify(resolve(root, filename));
        }).on('error', rejectWatch));
        for (const directory of new Set([...watched].map(dirname))) {
            try {
                const watcher = watch(directory, (_, filename) => {
                    if (filename) void monitor.notify(resolve(directory, filename));
                });
                watcher.on('error', error => { reader.skipped(directory, error); watcher.close(); });
                watchers.push(watcher);
            } catch (error) { reader.skipped(directory, error); }
        }
        process.stdout.write(`Watching artifact sources (${watchers.length} directories)\nWatch ready\n`);
        await failure;
    } finally {
        for (const watcher of watchers) watcher.close();
        await monitor.stop();
        if (timer) clearTimeout(timer);
        await pending;
    }
}
