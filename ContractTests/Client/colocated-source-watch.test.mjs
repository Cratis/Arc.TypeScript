// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, stat, symlink, unlink, utimes, writeFile } from 'node:fs/promises';
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

test('watch recovers source changes without native notifications from the moment it is ready', async () => {
    const directory = await scratch();
    const artifacts = join(directory, 'src/Features');
    await mkdir(artifacts, { recursive: true });
    const configuration = join(directory, 'tsconfig.json');
    await writeFile(configuration, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext',
        moduleResolution: 'Bundler', skipLibCheck: true }, include: ['src/**/*.ts'] }));
    const service = join(directory, 'src/Service.ts');
    await writeFile(service, 'export class Service {}\n');
    const backend = join(artifacts, 'Save.ts');
    const source = "import { command } from '@cratis/arc.core';\nimport { Service } from '../Service.js';\n" +
        '@command() export class Save { handle(service: Service): void { void service; } } // one\n';
    await writeFile(backend, source);
    const timestamp = 1_700_000_000; // Whole seconds survive utimes without losing nanosecond precision.
    await utimes(backend, timestamp, timestamp);
    const before = await stat(backend, { bigint: true });
    const metadata = join(artifacts, 'generatedMetadata.ts');
    const child = spawn(process.execPath, ['--import', join(import.meta.dirname, 'fixtures/silent-native-watch.mjs'),
        cli, '--project', configuration, '--artifacts', artifacts, '--output', artifacts,
        '--metadata', metadata, '--use-proxy-file-suffix', '--watch', '--watch-poll-interval', '100'],
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
    const generated = count => until(() => (text.match(/Generated \d+ changed file\(s\)/g) ?? []).length >= count);
    try {
        await until(() => text.includes('Watch ready\n'));
        // No readiness delay: equal-sized edits with a restored mtime must still be detected.
        await writeFile(backend, source.replace('// one', '// two'));
        await utimes(backend, timestamp, timestamp);
        const after = await stat(backend, { bigint: true });
        assert.equal(after.mtimeNs, before.mtimeNs);
        assert.equal(after.size, before.size);
        await generated(2);
        const temporary = join(directory, 'src/Replacement.ts');
        await writeFile(temporary, source.replace('// one', '// new'));
        await utimes(temporary, timestamp, timestamp);
        await rename(temporary, backend);
        await generated(3);
        const nested = join(artifacts, 'Nested');
        await mkdir(nested);
        const added = join(nested, 'Other.ts');
        await writeFile(added, "import { command } from '@cratis/arc.core';\n@command() export class Other { handle(): void {} }\n");
        await generated(4);
        assert.match(await readFile(join(nested, 'Other.proxy.ts'), 'utf8'), /class Other/);
        await unlink(added);
        await generated(5);
        await assert.rejects(readFile(join(nested, 'Other.proxy.ts')), { code: 'ENOENT' });
        await writeFile(service, 'export class Service { readonly marker = 1; }\n');
        await generated(6);
        const changes = (text.match(/Watch change detected/g) ?? []).length;
        await writeFile(metadata, await readFile(metadata, 'utf8'));
        const proxy = join(artifacts, 'Save.proxy.ts');
        await writeFile(proxy, await readFile(proxy, 'utf8'));
        // Observe several polling intervals after generated writes, not as a prerequisite for source edits.
        await setTimeout(600);
        assert.equal((text.match(/Watch change detected/g) ?? []).length, changes, text);
        assert.equal(errors, '');
    } finally { child.kill('SIGTERM'); await closed; }
});
