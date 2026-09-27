// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const web = fileURLToPath(new URL('.', import.meta.url));
const assets = join(web, 'dist/assets');
const bundles = (await readdir(assets)).filter(file => file.endsWith('.js'));
assert.ok(bundles.length > 0, 'The web build produced no JavaScript bundles');
for (const bundle of bundles) {
    const result = spawnSync(process.execPath, ['--check', '--input-type=module'], {
        input: await readFile(join(assets, bundle)), encoding: 'utf8'
    });
    assert.equal(result.status, 0, `${bundle} contains invalid JavaScript: ${result.stderr}`);
}

// Vite dev transforms files using their own nearest tsconfig, not Web/tsconfig.json.
const server = await createServer({ configFile: join(web, 'vite.config.ts'), root: web,
    server: { middlewareMode: true }, logLevel: 'error' });
try {
    const proxy = resolve(web, '../Features/Books/Listing/Book.proxy.ts');
    const result = await server.transformRequest(`/@fs/${proxy}`);
    assert.ok(result, 'Vite dev did not transform the co-located Book proxy');
    assert.doesNotMatch(result.code, /@field\s*\(/, 'Vite dev left native decorators in the co-located proxy');
    assert.match(result.code, /_decorate|__decorate/, 'Vite dev did not lower the proxy decorators');
} finally { await server.close(); }
