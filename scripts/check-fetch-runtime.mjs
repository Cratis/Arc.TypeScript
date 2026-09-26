// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageJson = JSON.parse(await readFile(resolve(root, 'Source/Core/package.json'), 'utf8'));
assert.equal(packageJson.exports['./fetch'].import, './dist/fetch.js');
const { outputFiles, metafile } = await build({ entryPoints: [resolve(root, 'scripts/fetch-runtime-scenario.mjs')],
    bundle: true, platform: 'neutral', format: 'cjs', write: false, metafile: true,
    external: ['node:async_hooks'] });
const external = Object.values(metafile.outputs).flatMap(output => output.imports.filter(item => item.external).map(item => item.path));
assert.ok(external.length > 0, 'Expected the AsyncLocalStorage import');
assert.deepEqual([...new Set(external)], ['node:async_hooks']);
assert.ok(Object.keys(metafile.inputs).some(input => input.endsWith('Source/Core/dist/fetch.js')),
    'Bundle must resolve the published Fetch entry');
const exports = {};
const context = vm.createContext({ exports, module: { exports },
    require(specifier) {
        assert.equal(specifier, 'node:async_hooks', `Unexpected Node import: ${specifier}`);
        return { AsyncLocalStorage };
    },
    Request, Response, Headers, URL, URLSearchParams, ReadableStream, TextEncoder, TextDecoder,
    AbortController, AbortSignal, Blob, crypto, performance, atob, btoa, setTimeout, clearTimeout, setInterval, clearInterval });
new vm.Script(outputFiles[0].text, { filename: 'arc-fetch-bundle.cjs' }).runInContext(context);
assert.equal(vm.runInContext('typeof process + ":" + typeof Buffer', context), 'undefined:undefined');
await context.module.exports.runScenario();
console.log('Fetch neutral bundle: 1 allowed external; VM (no process or Buffer): shared Fetch scenario passed');
