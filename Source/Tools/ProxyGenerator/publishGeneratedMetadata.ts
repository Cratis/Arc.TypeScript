// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { metadataMarker, metadataOwned } from './generatedSourceOwnership.js';

const digest = (text: string): string => createHash('sha256').update(text).digest('hex');
const stamped = (text: string): string => text.replace(metadataMarker, `${metadataMarker} Hash: ${digest(text)}`);
/** Fail a build when a source edit was not followed by generation. */
export async function checkGeneratedMetadata(file: string, text: string): Promise<void> {
    const existing = await readFile(file, 'utf8').catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    });
    if (existing !== stamped(text) || !metadataOwned(existing))
        throw new Error(`Stale or missing generated artifact metadata: ${file}; regenerate artifact metadata`);
}
/** Refuse handwritten or edited metadata before client output is changed. */
export async function preflightGeneratedMetadata(file: string): Promise<void> {
    const destination = await lstat(dirname(file));
    if (!destination.isDirectory()) throw new Error(`Metadata parent must be a directory: ${dirname(file)}`);
    const existingFile = await lstat(file).catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    });
    if (existingFile?.isSymbolicLink() || existingFile && !existingFile.isFile()) throw new Error(`Invalid metadata output: ${file}`);
    const previous = await readFile(file, 'utf8').catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    });
    if (previous !== undefined && !metadataOwned(previous)) throw new Error(`Refusing to overwrite handwritten or edited metadata: ${file}; review and delete the file before regenerating`);
}
/** Publish only owned metadata, keeping unchanged output byte-for-byte stable. */
export async function publishGeneratedMetadata(file: string, text: string): Promise<boolean> {
    await preflightGeneratedMetadata(file);
    const previous = await readFile(file, 'utf8').catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    });
    const next = stamped(text);
    if (previous === next) return false;
    const temporary = join(dirname(file), `.arc-${randomUUID()}.tmp`);
    await writeFile(temporary, next, { flag: 'wx' });
    try {
        const actual = await readFile(file, 'utf8').catch(error => {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
            throw error;
        });
        if (actual !== previous) throw new Error(`Metadata changed during generation: ${file}`);
        await rename(temporary, file);
    } finally { await unlink(temporary).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }); }
    return true;
}
