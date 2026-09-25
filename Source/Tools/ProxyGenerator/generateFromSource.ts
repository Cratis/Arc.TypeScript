// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { analyzeSource } from './analyzeSource.js';
import { sourceProgram } from './sourceProgram.js';
import type { SourceRenderOptions } from './renderSource.js';
import { metadataCollector } from './renderGeneratedMetadata.js';
import { preflightGeneratedMetadata } from './publishGeneratedMetadata.js';
import { buildSourceFiles } from './buildSourceFiles.js';
import { preflightSourceFiles } from './preflightSourceFiles.js';
import { publishSourceFiles } from './publishSourceFiles.js';

/** Options for generating browser clients from TypeScript source. */
export interface SourceGeneratorOptions extends SourceRenderOptions {
    readonly project: string;
    readonly artifacts: string;
    readonly output: string;
    readonly rootNamespace?: string;
    readonly skipIndexGeneration?: boolean;
    readonly skipOutputDeletion?: boolean;
    readonly emitInterfaces?: boolean;
    /** Absolute path of an optional source-generated server metadata module. */
    readonly metadata?: string;
    /** Opt into source-inferred bindings even when this invocation does not publish metadata. */
    readonly generatedMetadata?: boolean;
}

/** Analyze source once, preflight owned paths and publish only changed files. Never delete handwritten files. */
export async function generateFromSource(options: SourceGeneratorOptions): Promise<readonly string[]> {
    if (![options.project, options.artifacts, options.output, ...options.metadata ? [options.metadata] : []].every(isAbsolute))
        throw new Error('Project, artifacts, output and metadata must be absolute paths');
    const requested = resolve(options.output);
    const root = await lstat(requested);
    if (!root.isDirectory()) throw new Error('Output must be an existing directory');
    const output = await realpath(requested);
    const artifacts = await realpath(options.artifacts);
    if (!(await lstat(artifacts)).isDirectory()) throw new Error('Artifacts must be a directory');
    if (options.metadata) await preflightGeneratedMetadata(options.metadata);
    const program = sourceProgram(options.project);
    const collector = options.metadata ? metadataCollector(program, options.metadata) : undefined;
    const analysis = analyzeSource(options.project, artifacts, options.rootNamespace,
        !!collector || options.generatedMetadata === true, program, collector?.visit);
    const metadata = collector?.render(options.project, artifacts);
    const files = buildSourceFiles(analysis, options);
    const existing = await preflightSourceFiles(output, files, options);
    return publishSourceFiles(output, files, existing, options.skipOutputDeletion, options.metadata, metadata);
}
