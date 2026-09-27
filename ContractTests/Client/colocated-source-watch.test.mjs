// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { clientTest as test, scratch } from './scratch.mjs';

const root = resolve(import.meta.dirname, '../..');
const cli = join(root, 'Source/Tools/ProxyGenerator/dist/cli.js');

test('watch ignores metadata writes through a symlinked artifacts path', async () => {
    const directory = await scratch();
    const artifacts = join(directory, 'src/Features');
    const alias = join(directory, 'linked');
    await mkdir(artifacts, { recursive: true });
    await symlink(join(directory, 'src'), alias, 'dir');
    const configuration = join(directory, 'tsconfig.json');
    await writeFile(configuration, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext',
        moduleResolution: 'Bundler', skipLibCheck: true }, include: ['src/**/*.ts'] }));
    const backend = join(artifacts, 'Save.ts');
    await writeFile(backend, "import { command } from '@cratis/arc.core';\n@command() export class Save { handle(): void {} }\n");
    const metadata = join(alias, 'Features/generatedMetadata.ts');
    const child = spawn(process.execPath, [cli, '--project', configuration, '--artifacts', join(alias, 'Features'),
        '--output', artifacts, '--metadata', metadata, '--use-proxy-file-suffix', '--watch'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = ''; let errors = '';
    const closed = new Promise(resolve => child.once('close', resolve));
    child.stdout.on('data', chunk => { text += chunk.toString(); });
    child.stderr.on('data', chunk => { errors += chunk.toString(); });
    async function until(predicate) {
        for (let attempt = 0; attempt < 400 && !predicate(); attempt++) {
            assert.equal(child.exitCode, null, `Watch exited: ${errors}`);
            await setTimeout(50);
        }
        assert.ok(predicate(), `Watch timed out: ${text} ${errors}`);
    }
    try {
        await until(() => text.includes('Watch ready\n'));
        await writeFile(metadata, await readFile(metadata, 'utf8'));
        await setTimeout(450);
        assert.equal((text.match(/Watch change detected/g) ?? []).length, 0, text);
        await writeFile(backend, "import { command } from '@cratis/arc.core';\n@command() export class Save { handle(): void {} } // changed\n");
        await until(() => (text.match(/Generated \d+ changed file\(s\)/g) ?? []).length >= 2);
        await setTimeout(450);
        assert.equal((text.match(/Watch change detected/g) ?? []).length, 1, text);
        assert.equal(errors, '');
    } finally { child.kill('SIGTERM'); await closed; await unlink(alias); }
});

test('watch regenerates for handwritten backend changes when output contains artifacts', async () => {
    const directory = await scratch();
    const output = join(directory, 'src');
    const artifacts = join(output, 'Features');
    await mkdir(artifacts, { recursive: true });
    const configuration = join(directory, 'tsconfig.json');
    await writeFile(configuration, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext',
        moduleResolution: 'Bundler', skipLibCheck: true }, include: ['src/**/*.ts'] }));
    const backend = join(artifacts, 'Save.ts');
    await writeFile(backend, "import { command } from '@cratis/arc.core';\n@command() export class Save { handle(): void {} }\n");
    const child = spawn(process.execPath, [cli, '--project', configuration, '--artifacts', artifacts,
        '--output', output, '--use-proxy-file-suffix', '--watch'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = ''; let errors = '';
    const closed = new Promise(resolve => child.once('close', resolve));
    child.stdout.on('data', chunk => { text += chunk.toString(); });
    child.stderr.on('data', chunk => { errors += chunk.toString(); });
    async function until(predicate) {
        for (let attempt = 0; attempt < 400 && !predicate(); attempt++) {
            assert.equal(child.exitCode, null, `Watch exited: ${errors}`);
            await setTimeout(50);
        }
        assert.ok(predicate(), `Watch timed out: ${text} ${errors}`);
    }
    try {
        await until(() => text.includes('Watch ready\n'));
        await setTimeout(450);
        assert.equal((text.match(/Watch change detected/g) ?? []).length, 0, text);
        await writeFile(backend, "import { command } from '@cratis/arc.core';\n@command() export class Save { handle(): void {} } // changed\n");
        await until(() => (text.match(/Generated \d+ changed file\(s\)/g) ?? []).length >= 2);
        await setTimeout(450);
        assert.equal((text.match(/Watch change detected/g) ?? []).length, 1, text);
        assert.equal(errors, '');
    } finally { child.kill('SIGTERM'); await closed; }
});
