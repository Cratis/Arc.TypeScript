// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { SourceGeneratorOptions } from './generateFromSource.js';

/** Parse the source-generation CLI options without changing its accepted switches. */
export function parseSourceOptions(values: readonly string[], usage: string):
    { configuration: SourceGeneratorOptions; watch: boolean; checkMetadata: boolean } {
    const options: Record<string, string | boolean> = {};
    const flags = ['--skip-command-name-in-route', '--skip-query-name-in-route', '--use-proxy-file-suffix', '--js-import-specifiers',
        '--skip-index-generation', '--skip-output-deletion', '--emit-interfaces', '--watch', '--check-metadata',
        '--use-generated-metadata'];
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
        generatedMetadata: options['--use-generated-metadata'] === true,
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
    return { configuration, watch: options['--watch'] === true, checkMetadata: options['--check-metadata'] === true };
}
