// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { bodyHash, digest, marker, owned } from './generatedSourceOwnership.js';
import type { SourceFileEntry } from './buildSourceFiles.js';
import type { SourceGeneratorOptions } from './generateFromSource.js';

async function readExisting(output: string): Promise<Map<string, string>> {
    const existing = new Map<string, string>();
    const visit = async (directory: string): Promise<void> => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name);
            if (entry.isSymbolicLink()) throw new Error(`Symlink in output: ${path}`);
            if (entry.isDirectory()) await visit(path);
            else if (entry.isFile() && entry.name.endsWith('.ts')) existing.set(relative(output, path), await readFile(path, 'utf8'));
        }
    };
    await visit(output);
    return existing;
}

function verifyOwnership(existing: ReadonlyMap<string, string>, files: ReadonlyMap<string, SourceFileEntry>, options: SourceGeneratorOptions): void {
    for (const [path, text] of existing) {
        if (basename(path) === 'index.ts' && text.startsWith(marker) && !owned(text))
            throw new Error(`Refusing to overwrite edited generated barrel: ${path}`);
        if (files.has(path) && basename(path) === 'index.ts') continue;
        if (files.has(path) && bodyHash(text) !== digest(files.get(path)!.text) && !owned(text))
            throw new Error(`Refusing to overwrite handwritten or edited file: ${path}`);
        if (!files.has(path) && !options.skipOutputDeletion && text.startsWith(marker) && !owned(text))
            throw new Error(`Refusing to delete edited generated file: ${path}`);
    }
}

function prepareBarrels(existing: ReadonlyMap<string, string>, files: Map<string, SourceFileEntry>, options: SourceGeneratorOptions): void {
    // Preflight barrels before any write. Handwritten barrels retain all lines except references to deleted owned files.
    for (const [path, previous] of existing) {
        if (basename(path) !== 'index.ts') continue;
        const entry = files.get(path);
        const body = owned(previous) ? previous.slice(previous.indexOf('\n') + 1) : previous;
        const retained = body.split('\n').filter(line => {
            const match = /^export \* from '\.\/([^']+)';$/.exec(line);
            if (!match) return !!line.trim();
            const target = join(dirname(path), `${match[1]}.ts`);
            return !(!options.skipOutputDeletion && !files.has(target) && owned(existing.get(target) ?? ''));
        });
        if (owned(previous)) {
            if (entry) entry.text = [...retained.filter(line => {
                const match = /^export \* from '\.\/([^']+)';$/.exec(line);
                return !match || !owned(existing.get(join(dirname(path), `${match[1]}.ts`)) ?? '');
            }), ...entry.text.trimEnd().split('\n')].join('\n') + '\n';
        } else {
            const text = retained.join('\n') + '\n';
            if (entry) files.delete(path);
            if (text !== previous) files.set(path, { source: '', text, handwritten: true });
        }
    }
}

/** Refuse edits to non-owned output before publishing any generated files. */
export async function preflightSourceFiles(output: string, files: Map<string, SourceFileEntry>,
    options: SourceGeneratorOptions): Promise<Map<string, string>> {
    const existing = await readExisting(output);
    verifyOwnership(existing, files, options);
    prepareBarrels(existing, files, options);
    return existing;
}
