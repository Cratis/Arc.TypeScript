// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { watch, watchFile, unwatchFile } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { sourceProgram } from './sourceProgram.js';
import type { SourceGeneratorOptions } from './generateFromSource.js';

/** Regenerate on changes in artifacts or in external source dependencies. */
export async function watchSource(configuration: SourceGeneratorOptions, generate: () => Promise<void>): Promise<void> {
    const root = resolve(configuration.artifacts);
    const metadata = configuration.metadata && resolve(configuration.metadata);
    const outputRoot = resolve(configuration.output);
    const external = sourceProgram(configuration.project).getSourceFiles()
        .filter(file => !file.isDeclarationFile && !file.fileName.includes(`${sep}node_modules${sep}`))
        .map(file => resolve(file.fileName)).filter(file => file !== metadata &&
            !file.startsWith(root + sep) && !file.startsWith(outputRoot + sep));
    const watched = new Set(external);
    let timer: NodeJS.Timeout | undefined;
    let pending: Promise<void> = Promise.resolve();
    const schedule = () => {
        if (timer) clearTimeout(timer);
        else process.stdout.write('Watch change detected\n');
        timer = setTimeout(() => {
            timer = undefined;
            pending = pending.then(generate).catch(error => { console.error(error); process.exitCode = 1; });
        }, 150);
    };
    const watchers = [watch(root, { recursive: true }, (_, filename) => {
        if (!filename) return schedule();
        const file = resolve(root, filename);
        if (file !== metadata && !file.startsWith(outputRoot + sep) && file.endsWith('.ts') && !file.endsWith('.d.ts') &&
            file.startsWith(root + sep)) schedule();
    }), ...[...new Set(external.map(dirname))].map(directory => watch(directory, (_, filename) => {
        if (filename && watched.has(resolve(directory, filename))) schedule();
    }))];
    // Directory notifications may be coalesced or missed on macOS; stat watched external files as a fallback.
    const fileChanges = new Map([...watched].map(file => [file, (current: import('node:fs').Stats, previous: import('node:fs').Stats) => {
        if (current.mtimeMs !== previous.mtimeMs || current.ctimeMs !== previous.ctimeMs || current.size !== previous.size || current.ino !== previous.ino)
            schedule();
    }]));
    for (const [file, listener] of fileChanges) watchFile(file, { interval: 250 }, listener);
    const watchFailure = new Promise<void>((_, reject) => {
        for (const watcher of watchers) watcher.on('error', reject);
    });
    process.stdout.write(`Watching artifact sources (${watchers.length} directories)\nWatch ready\n`);
    try { await watchFailure; }
    finally {
        if (timer) clearTimeout(timer);
        for (const watcher of watchers) watcher.close();
        for (const [file, listener] of fileChanges) unwatchFile(file, listener);
        await pending;
    }
}
