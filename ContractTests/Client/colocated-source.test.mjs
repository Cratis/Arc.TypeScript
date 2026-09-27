// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { ArcApplication, discoveryFiles } from '@cratis/arc.core';
import { analyzeSource, generateFromSource, renderGeneratedMetadata } from '@cratis/arc.proxygenerator';
import { content } from '../../Source/Tools/ProxyGenerator/dist/generatedSourceOwnership.js';
import { clientTest as test, scratch } from './scratch.mjs';

const root = resolve(import.meta.dirname, '../..');
const cli = join(root, 'Source/Tools/ProxyGenerator/dist/cli.js');
async function project() {
    const directory = await scratch();
    const src = join(directory, 'src');
    const artifacts = join(src, 'Features');
    await mkdir(artifacts, { recursive: true });
    const configuration = join(src, 'tsconfig.json');
    await writeFile(configuration, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext',
        moduleResolution: 'Bundler', strict: true, skipLibCheck: true }, include: ['Features/**/*.ts'] }));
    await writeFile(join(artifacts, 'Save.ts'), `import { command } from '@cratis/arc.core';
@command() export class Save { handle(): void {} }
`);
    await writeFile(join(artifacts, 'SaveForm.tsx'), 'export const SaveForm = () => null;\n');
    return { directory, src, artifacts, configuration, options: { project: configuration, artifacts,
        output: artifacts, useProxyFileSuffix: true } };
}

test('co-located generation requires distinct names before writing and never emits barrels', async () => {
    const { artifacts, options } = await project();
    await assert.rejects(generateFromSource({ ...options, useProxyFileSuffix: false }), /--use-proxy-file-suffix is required/);
    assert.deepEqual((await readdir(artifacts)).sort(), ['Save.ts', 'SaveForm.tsx']);
    assert.equal((await generateFromSource(options)).length, 1);
    assert.deepEqual((await readdir(artifacts)).sort(), ['Save.proxy.ts', 'Save.ts', 'SaveForm.tsx']);
    assert.deepEqual(await generateFromSource(options), []);
    assert.deepEqual(analyzeSource(options.project, artifacts).operations.map(item => item.name), ['Save']);
    await writeFile(join(artifacts, 'Save.proxy.js'), 'throw new Error("Never imported");\n');
    assert.deepEqual(discoveryFiles(artifacts).map(path => path.split('/').at(-1)), ['Save.ts']);
});

test('runtime discovery imports backend JavaScript but not co-located proxies or React components', async () => {
    const { src } = await project();
    const emitted = join(src, 'Emitted');
    await mkdir(emitted);
    await writeFile(join(emitted, 'Backend.js'), 'export const backend = true;\n');
    await writeFile(join(emitted, 'Backend.proxy.js'), 'throw new Error("Proxy imported");\n');
    await writeFile(join(emitted, 'BackendForm.tsx'), 'throw new Error("Component imported");\n');
    await ArcApplication.createBuilder().discover(pathToFileURL(emitted + '/'));
    assert.deepEqual(discoveryFiles(emitted).map(path => path.split('/').at(-1)), ['Backend.js']);
});

test('co-located generation leaves handwritten files and deletes only stale owned files', async () => {
    const { artifacts, options } = await project();
    await generateFromSource(options);
    const source = await readFile(join(artifacts, 'Save.proxy.ts'), 'utf8');
    const stale = join(artifacts, 'Stale.proxy.ts');
    await writeFile(stale, source);
    const barrel = join(artifacts, 'index.ts');
    await writeFile(barrel, "export * from './Stale.proxy';\n");
    await generateFromSource(options);
    assert.ok(!(await readdir(artifacts)).includes('Stale.proxy.ts'));
    assert.equal(await readFile(barrel, 'utf8'), "export * from './Stale.proxy';\n");
    await writeFile(stale, 'export const custom = true;\n');
    await generateFromSource(options);
    assert.equal(await readFile(stale, 'utf8'), 'export const custom = true;\n');
    await writeFile(join(artifacts, 'Save.proxy.ts'), 'export const custom = true;\n');
    await assert.rejects(generateFromSource(options), /Refusing to overwrite handwritten or edited file: Save.proxy.ts/);
    assert.equal(await readFile(stale, 'utf8'), 'export const custom = true;\n');
});

test('source analysis and metadata skip intact generated classes even when tsconfig includes them', async () => {
    const { artifacts, options } = await project();
    await writeFile(join(artifacts, 'Old.ts'), content('old', `import { command } from '@cratis/arc.core';
@command() export class Old { handle(): void {} }
`));
    assert.deepEqual(analyzeSource(options.project, artifacts).operations.map(item => item.name), ['Save']);
    assert.doesNotMatch(renderGeneratedMetadata(options.project, artifacts, join(artifacts, 'generatedMetadata.ts')), /Old/);
});

test('handwritten slice comments mentioning the generated marker are still analyzed', async () => {
    const { artifacts, options } = await project();
    await writeFile(join(artifacts, 'Old.ts'), `// Copyright (c) Cratis. All rights reserved.
// This handwritten slice mentions // @generated by Cratis. Source: old
import { command } from '@cratis/arc.core';
@command() export class Old { handle(): void {} }
`);
    assert.deepEqual(analyzeSource(options.project, artifacts).operations.map(item => item.name), ['Old', 'Save']);
    assert.match(renderGeneratedMetadata(options.project, artifacts, join(artifacts, 'generatedMetadata.ts')), /Old/);
    await generateFromSource(options);
    assert.ok((await readdir(artifacts)).includes('Old.proxy.ts'));
    assert.ok((await readdir(artifacts)).includes('Old.ts'));
});

test('nested output with backend sources requires a suffix and never writes barrels', async () => {
    const { src, artifacts, options } = await project();
    const nestedOptions = { ...options, artifacts: src, output: artifacts, segmentsToSkip: 1 };
    await assert.rejects(generateFromSource({ ...nestedOptions, useProxyFileSuffix: false }), /--use-proxy-file-suffix is required/);
    assert.deepEqual((await readdir(artifacts)).sort(), ['Save.ts', 'SaveForm.tsx']);
    await generateFromSource(nestedOptions);
    assert.deepEqual((await readdir(artifacts)).sort(), ['Save.proxy.ts', 'Save.ts', 'SaveForm.tsx']);
    assert.deepEqual(await generateFromSource(nestedOptions), []);
});

test('nested dedicated output keeps barrels and optional suffix; equal and ancestor output require co-location safeguards', async () => {
    const { src, artifacts, options } = await project();
    const nested = join(artifacts, 'client');
    await mkdir(nested);
    await generateFromSource({ ...options, output: nested, useProxyFileSuffix: false });
    assert.deepEqual((await readdir(nested)).sort(), ['Save.ts', 'index.ts']);
    assert.deepEqual(analyzeSource(options.project, artifacts).operations.map(item => item.name), ['Save']);
    await generateFromSource({ ...options, output: nested });
    assert.deepEqual((await readdir(nested)).sort(), ['Save.proxy.ts', 'index.ts']);
    assert.deepEqual(analyzeSource(options.project, artifacts).operations.map(item => item.name), ['Save']);
    for (const output of [artifacts, src]) {
        await assert.rejects(generateFromSource({ ...options, output, useProxyFileSuffix: false }), /--use-proxy-file-suffix is required/);
        await generateFromSource({ ...options, output });
        assert.ok(!(await readdir(output)).includes('index.ts'));
    }
});

test('nested dedicated output refuses an edited generated file before requiring a suffix', async () => {
    const { artifacts, options } = await project();
    const nested = join(artifacts, 'client');
    await mkdir(nested);
    const dedicated = { ...options, output: nested, useProxyFileSuffix: false };
    await generateFromSource(dedicated);
    const proxy = join(nested, 'Save.ts');
    const edited = `${await readFile(proxy, 'utf8')} // edited\n`;
    await writeFile(proxy, edited);
    await assert.rejects(generateFromSource(dedicated), /Refusing to overwrite handwritten or edited file: Save.ts/);
    assert.equal(await readFile(proxy, 'utf8'), edited);
    assert.deepEqual((await readdir(nested)).sort(), ['Save.ts', 'index.ts']);
});

test('metadata check skips owned nested dedicated output excluded from the project', async () => {
    const { src, artifacts, configuration, options } = await project();
    const nested = join(artifacts, 'client');
    const metadata = join(src, 'generatedMetadata.ts');
    await mkdir(nested);
    await writeFile(configuration, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext',
        moduleResolution: 'Bundler', strict: true, skipLibCheck: true }, include: ['Features/**/*.ts'],
    exclude: ['Features/client'] }));
    await generateFromSource({ ...options, output: nested, useProxyFileSuffix: false, metadata });
    assert.deepEqual((await readdir(nested)).sort(), ['Save.ts', 'index.ts']);
    const checked = spawnSync(process.execPath, [cli, '--project', configuration, '--artifacts', artifacts,
        '--output', nested, '--metadata', metadata, '--check-metadata'], { cwd: root, encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr);
    assert.match(checked.stdout, /Generated artifact metadata is current/);
    await writeFile(join(nested, 'Edited.ts'), 'export const edited = true;\n');
    assert.throws(() => renderGeneratedMetadata(configuration, artifacts, metadata), /not included in/);
});

test('nested output watch ignores generated files and barrels but regenerates on backend edits', async () => {
    const { artifacts, configuration } = await project();
    const nested = join(artifacts, 'client');
    await mkdir(nested);
    const child = spawn(process.execPath, [cli, '--project', configuration, '--artifacts', artifacts,
        '--output', nested, '--watch'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; let errors = '';
    const closed = new Promise(resolve => child.once('close', resolve));
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { errors += chunk.toString(); });
    async function until(predicate) {
        for (let attempt = 0; attempt < 400 && !predicate(); attempt++) {
            assert.equal(child.exitCode, null, `Watch exited: ${errors}`);
            await setTimeout(50);
        }
        assert.ok(predicate(), `Watch timed out: ${output} ${errors}`);
    }
    try {
        await until(() => output.includes('Watch ready\n'));
        assert.deepEqual((await readdir(nested)).sort(), ['Save.ts', 'index.ts']);
        await writeFile(join(nested, 'index.ts'), "export * from './Save';\n// changed barrel\n");
        await setTimeout(450);
        assert.equal((output.match(/Watch change detected/g) ?? []).length, 0, output);
        await writeFile(join(artifacts, 'Save.ts'), `import { command } from '@cratis/arc.core';
@command() export class Save { handle(): void {} } // updated
`);
        await until(() => (output.match(/Generated \d+ changed file\(s\)/g) ?? []).length >= 2);
        await setTimeout(450);
        assert.equal((output.match(/Watch change detected/g) ?? []).length, 1, output);
        assert.equal(errors, '');
    } finally { child.kill('SIGTERM'); await closed; }
});

test('nested co-located CLI watch ignores its writes and regenerates on edits inside output', async () => {
    const { src, artifacts, configuration } = await project();
    const child = spawn(process.execPath, [cli, '--project', configuration, '--artifacts', src,
        '--output', artifacts, '--segments-to-skip', '1', '--use-proxy-file-suffix', '--watch'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; let errors = '';
    const closed = new Promise(resolve => child.once('close', resolve));
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { errors += chunk.toString(); });
    async function until(predicate) {
        for (let attempt = 0; attempt < 400 && !predicate(); attempt++) {
            assert.equal(child.exitCode, null, `Watch exited: ${errors}`);
            await setTimeout(50);
        }
        assert.ok(predicate(), `Watch timed out: ${output} ${errors}`);
    }
    try {
        await until(() => output.includes('Watch ready\n'));
        assert.deepEqual((await readdir(artifacts)).sort(), ['Save.proxy.ts', 'Save.ts', 'SaveForm.tsx']);
        await setTimeout(450);
        assert.equal((output.match(/Watch change detected/g) ?? []).length, 0, output);
        await writeFile(join(artifacts, 'Save.ts'), `import { command } from '@cratis/arc.core';
@command() export class Save { handle(): void {} }
@command() export class Delete { handle(): void {} }
`);
        await until(() => (output.match(/Generated \d+ changed file\(s\)/g) ?? []).length >= 2);
        assert.ok((await readdir(artifacts)).includes('Delete.proxy.ts'));
        assert.ok(!(await readdir(artifacts)).includes('index.ts'));
        await setTimeout(450);
        assert.equal((output.match(/Watch change detected/g) ?? []).length, 1, output);
        assert.equal(errors, '');
    } finally { child.kill('SIGTERM'); await closed; }
});

test('co-located CLI watch ignores its writes but regenerates on backend edits', async () => {
    const { artifacts, configuration } = await project();
    const child = spawn(process.execPath, [cli, '--project', configuration, '--artifacts', artifacts,
        '--output', artifacts, '--use-proxy-file-suffix', '--watch'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; let errors = '';
    const closed = new Promise(resolve => child.once('close', resolve));
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { errors += chunk.toString(); });
    async function until(predicate) {
        for (let attempt = 0; attempt < 400 && !predicate(); attempt++) {
            assert.equal(child.exitCode, null, `Watch exited: ${errors}`);
            await setTimeout(50);
        }
        assert.ok(predicate(), `Watch timed out: ${output} ${errors}`);
    }
    try {
        await until(() => output.includes('Watch ready\n'));
        await setTimeout(450);
        assert.equal((output.match(/Watch change detected/g) ?? []).length, 0, output);
        await writeFile(join(artifacts, 'Save.ts'), `import { command } from '@cratis/arc.core';
@command() export class Save { handle(): void {} } // updated
`);
        await until(() => (output.match(/Generated \d+ changed file\(s\)/g) ?? []).length >= 2);
        await setTimeout(450);
        assert.equal((output.match(/Watch change detected/g) ?? []).length, 1, output);
        assert.equal(errors, '');
    } finally { child.kill('SIGTERM'); await closed; }
});
