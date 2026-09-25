// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { dirname, join } from 'node:path';
import { filename, queryClassName, renderSource } from './renderSource.js';
import type { SourceGeneratorOptions } from './generateFromSource.js';
import type { SourceAnalysis } from './SourceAnalysis.js';

/** A generated file's identity and content, or an updated handwritten barrel. */
export interface SourceFileEntry { source: string; text: string; handwritten?: boolean }

/** Render source models, operations, and their generated barrels. */
export function buildSourceFiles(analysis: SourceAnalysis, options: SourceGeneratorOptions): Map<string, SourceFileEntry> {
    const rendered = renderSource(analysis, options);
    const sources = new Map([
        ...analysis.models.map(model => [filename(model.name, model.namespace, options),
            [model.namespace, model.name].filter(Boolean).join('.')] as const),
        ...analysis.operations.map(operation => [
            filename(operation.kind === 'command' ? operation.name : queryClassName(operation.name),
                operation.namespace, options),
            [operation.namespace, operation.owner, ...(operation.kind === 'command' ? [] : [operation.name])]
                .filter(Boolean).join('.')
        ] as const)
    ]);
    const files = new Map<string, SourceFileEntry>([...rendered].map(([path, text]) =>
        [path, { source: sources.get(path) ?? path, text }]));
    const directories = new Set([...files.keys()].map(dirname));
    if (!options.skipIndexGeneration) for (const directory of directories) {
        const names = [...files.keys()].filter(path => dirname(path) === directory)
            .map(path => `export * from './${path.slice(directory === '.' ? 0 : directory.length + 1).replace(/\.ts$/, '')}';`).sort();
        files.set(join(directory, 'index.ts'), { source: '', text: names.join('\n') + '\n' });
    }
    return files;
}
