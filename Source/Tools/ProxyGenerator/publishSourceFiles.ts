// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { randomUUID } from 'node:crypto';
import { chmod, link, lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import type { SourceFileEntry } from './buildSourceFiles.js';
import { bodyHash, content, digest, owned } from './generatedSourceOwnership.js';
import { publishGeneratedMetadata } from './publishGeneratedMetadata.js';

async function publishFile(output: string, path: string, entry: SourceFileEntry,
    previous: string | undefined): Promise<string | undefined> {
    const text = entry.handwritten ? entry.text : previous && bodyHash(previous) === digest(entry.text) ?
        previous : content(entry.source, entry.text);
    if (previous === text) return undefined;
    const destination = join(output, path);
    if (!destination.startsWith(output + sep) || path.includes('..')) throw new Error(`Unsafe output: ${path}`);
    await mkdir(dirname(destination), { recursive: true });
    const actual = await readFile(destination, 'utf8').catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    });
    if (previous !== actual) throw new Error(`Output changed during generation: ${path}`);
    const temporary = join(dirname(destination), `.arc-${randomUUID()}.tmp`);
    await writeFile(temporary, text, {
        flag: 'wx', mode: previous === undefined ? 0o666 & ~process.umask() : (await lstat(destination)).mode & 0o777
    });
    try {
        if (previous === undefined) await link(temporary, destination);
        else { await chmod(temporary, (await lstat(destination)).mode & 0o777); await rename(temporary, destination); }
    } finally { await unlink(temporary).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }); }
    return destination;
}

/** Publish changed source files, cleanup and metadata, reporting partial commits on failure. */
export async function publishSourceFiles(output: string, files: Map<string, SourceFileEntry>, existing: ReadonlyMap<string, string>,
    skipOutputDeletion: boolean | undefined, metadataPath: string | undefined, metadata: string | undefined): Promise<readonly string[]> {
    const changed: string[] = [];
    try {
        for (const [path, entry] of files) {
            const destination = await publishFile(output, path, entry, existing.get(path));
            if (destination) changed.push(destination);
        }
        for (const [path, text] of existing) {
            if (!skipOutputDeletion && !files.has(path) && owned(text)) {
                const destination = join(output, path);
                if (await readFile(destination, 'utf8') !== text)
                    throw new Error(`Output changed during cleanup: ${path}`);
                await unlink(destination);
                changed.push(destination);
            }
        }
        if (metadataPath && metadata && await publishGeneratedMetadata(metadataPath, metadata)) changed.push(metadataPath);
    } catch (error) {
        if (changed.length)
            throw new AggregateError([error], `Source generation partially committed: ${changed.join(', ')}`, { cause: error });
        throw error;
    }
    return changed;
}
