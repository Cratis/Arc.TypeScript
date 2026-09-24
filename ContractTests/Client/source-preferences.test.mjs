// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { QueryHttpMethod } from '@cratis/arc/queries';
import { QueryHttpMethod as SourceQueryHttpMethod } from '@cratis/arc.core';
import { renderSource } from '@cratis/arc.proxygenerator';
import { clientTest as test, scratch } from './scratch.mjs';

const root = resolve(import.meta.dirname, '../..');
test('source preferences compile and execute against published client classes', async () => {
    const result = { text: 'string', constructor: 'String', enumerable: false, nullable: false, void: false };
    const operations = [
        { kind: 'command', name: 'Save', owner: 'Save', namespace: 'Tasks', roles: [], fields: [],
            result: { ...result, text: 'void', constructor: 'Object', void: true }, treatWarningsAsErrors: true },
        { kind: 'query', name: 'find', owner: 'Item', namespace: 'Tasks', roles: [], fields: [], result,
            treatWarningsAsErrors: true, httpMethod: SourceQueryHttpMethod.Query }
    ];
    const directory = await scratch();
    const source = join(directory, 'src');
    await mkdir(join(source, 'Tasks'), { recursive: true });
    for (const [path, text] of renderSource({ operations, models: [] }, { jsImportSpecifiers: true }))
        await writeFile(join(source, path), text);
    const tsconfig = { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
        skipLibCheck: false, outDir: './dist', rootDir: './src', types: ['node'] }, include: ['src/**/*.ts'] };
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify(tsconfig));
    execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', join(directory, 'tsconfig.json')], { cwd: root });
    const { Save } = await import(pathToFileURL(join(directory, 'dist/Tasks/Save.js')).href);
    const { Find } = await import(pathToFileURL(join(directory, 'dist/Tasks/Find.js')).href);
    assert.equal(new Save().treatWarningsAsErrors, true);
    assert.equal(new Find().treatWarningsAsErrors, true);
    assert.equal(new Find()._httpMethod, QueryHttpMethod.Query);
});
