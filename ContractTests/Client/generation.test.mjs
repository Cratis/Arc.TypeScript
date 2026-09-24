// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { access, chmod, lstat, mkdir, readFile, readdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { clientTest as test, cleanupScratch, scratch } from './scratch.mjs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import express from 'express';
import fastify from 'fastify';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, defineCommand, defineQuery, exportClientManifest, queryPage } from '@cratis/arc.core';
import { mountExpress } from '@cratis/arc.express';
import { mountFastify } from '@cratis/arc.fastify';
import { mountHono } from '@cratis/arc.hono';
import { generateClient, renderClientManifest } from '@cratis/arc.proxygenerator';
import { Paging, QueryHttpMethod, SortDirection, Sorting } from '@cratis/arc/queries';

const root = resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);
const arcPath = require.resolve('@cratis/arc/package.json');
const fundamentalsPath = require.resolve('@cratis/fundamentals/package.json');
test('pinned published client exports and dependency graph share one Fundamentals instance', () => {
    assert.equal(require('@cratis/arc/package.json').version, '22.19.1');
    assert.equal(require('@cratis/fundamentals/package.json').version, '7.19.3');
    assert.equal(require('rxjs/package.json').version, '7.8.2');
    assert.equal(require.resolve('@cratis/fundamentals/package.json', { paths: [arcPath] }), fundamentalsPath);
});
const string = { kind: 'string' };
const widget = { kind: 'dto', name: 'Widget', fields: [{ name: 'id', type: string }, { name: 'name', type: string }] };
const authentication = request => request.headers.get('authorization') === 'Bearer secret'
    ? { status: AuthenticationStatus.Authenticated, principal: { id: 'client', roles: ['reader', 'writer'], isAuthenticated: true } }
    : { status: AuthenticationStatus.Anonymous };
function fixture() {
    let handled = 0;
    let invalidOutput = false;
    let invalidQueryOutput = false;
    const items = [];
    const server = new ArcServer({
        authentication: [authentication],
        commands: [defineCommand({ name: 'CreateWidget', namespace: 'Sales', schema: z.object({ name: z.string(), note: z.string().optional() }), authorization: { roles: ['writer'] },
            clientOutput: { output: widget },
            handle: ({ name }) => { handled++; const item = invalidOutput ? { id: 1, name: 'PRIVATE ERROR DETAIL' } : { id: String(handled), name }; if (!invalidOutput) items.push(item); return item; } })],
        queries: [defineQuery({ name: 'GetWidgets', namespace: 'Sales', path: '/v1/widgets/search', schema: z.object({ term: z.string(), optional: z.boolean().optional() }), authorization: { roles: ['reader'] },
            clientOutput: { output: { kind: 'array', element: widget } }, perform: ({ term }) => invalidQueryOutput ? [{ id: 3, name: 'PRIVATE QUERY DETAIL' }] : items.filter(item => item.name.includes(term)) })]
    });
    return { server, count: () => handled, invalid: () => { invalidOutput = true; }, invalidQuery: () => { invalidQueryOutput = true; } };
}
function compile(dir, negative = false) {
    const tsconfig = { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, verbatimModuleSyntax: true,
        skipLibCheck: false, noEmitOnError: true, outDir: './dist', rootDir: './src', types: ['node'] }, include: ['src/*.ts'] };
    return writeFile(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig)).then(() => {
        if (!negative) { execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', join(dir, 'tsconfig.json')], { cwd: root }); return ''; }
        return spawnSync(join(root, 'node_modules/.bin/tsc'), ['-p', join(dir, 'tsconfig.json')], { cwd: root, encoding: 'utf8' });
    });
}
async function host(kind, server) {
    if (kind === 'express') {
        const app = express(); mountExpress(app, server);
        const listener = app.listen(0, '127.0.0.1');
        await new Promise(resolve => listener.once('listening', resolve));
        return { origin: `http://127.0.0.1:${listener.address().port}`, close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())) };
    }
    if (kind === 'fastify') {
        const app = fastify(); mountFastify(app, server);
        await app.listen({ port: 0, host: '127.0.0.1' });
        return { origin: app.listeningOrigin, close: () => app.close() };
    }
    const app = new Hono(); mountHono(app, server);
    const listener = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
    await new Promise(resolve => listener.once('listening', resolve));
    return { origin: `http://127.0.0.1:${listener.address().port}`, close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())) };
}

test('resolved graph exports without executing callbacks and generates deterministic typed proxies', async () => {
    const { server, count } = fixture();
    const manifest = exportClientManifest(server);
    assert.equal(count(), 0);
    assert.deepEqual(manifest.operations.map(item => [item.id, item.route, item.methods]), [
        ['Sales.CreateWidget', '/api/sales/create-widget', ['POST']],
        ['Sales.GetWidgets', '/v1/widgets/search', ['GET', 'QUERY']]
    ]);
    assert.equal(manifest.operations[1].queryName, 'Sales.GetWidgets');
    let callbacks = 0;
    const unopened = new ArcServer({ commands: [defineCommand({ name: 'Unopened', schema: z.object({}), clientOutput: { output: { kind: 'void' } },
        authorize: () => { callbacks++; throw Error('authorize invoked'); },
        validate: () => { callbacks++; throw Error('validator invoked'); },
        provide: () => { callbacks++; throw Error('provider invoked'); },
        handle: () => { callbacks++; throw Error('handler invoked'); } })] });
    const exported = exportClientManifest(unopened);
    assert.equal(exported.operations[0].dynamicAuthorization, true);
    assert.equal(callbacks, 0);
    await unopened.dispose();
    const shuffled = { ...manifest, operations: [...manifest.operations].reverse().map(operation => ({ ...operation, input: [...operation.input].reverse() })) };
    assert.deepEqual([...renderClientManifest(manifest)], [...renderClientManifest(shuffled)]);
    const dir = await scratch(); const output = join(dir, 'src'); await mkdir(output);
    const changes = await generateClient(manifest, output);
    assert.equal(changes.length, 3);
    assert.deepEqual(await generateClient(shuffled, output), []);
    const content = await readFile(join(output, 'Sales_GetWidgets.proxy.ts'), 'utf8');
    assert.match(content, /Sales.GetWidgets/);
    assert.match(content, /\.\/Widget.proxy.js/);
    await compile(dir);
    const { Sales_CreateWidget } = await import(pathToFileURL(join(dir, 'dist/Sales_CreateWidget.proxy.js')));
    const { Sales_GetWidgets } = await import(pathToFileURL(join(dir, 'dist/Sales_GetWidgets.proxy.js')));
    assert.equal(new Sales_CreateWidget().route, '/api/sales/create-widget');
    assert.equal(new Sales_GetWidgets().queryName, 'Sales.GetWidgets');
    const cliManifest = join(dir, 'manifest.json'); await writeFile(cliManifest, JSON.stringify(manifest));
    await assert.rejects(access(join(dir, 'node_modules/.bin/arc-proxygenerator')), { code: 'ENOENT' });
    // The fixture has no CLI bin link and its PATH cannot find the workspace bin.
    const cli = spawnSync(process.execPath, [join(root, 'Source/Tools/ProxyGenerator/dist/cli.js'), cliManifest, output],
        { cwd: dir, env: { ...process.env, PATH: dirname(process.execPath) }, encoding: 'utf8' });
    assert.equal(cli.error, undefined);
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /Generated 0 changed client file/);
    const badSource = join(output, 'incorrect.ts');
    await writeFile(badSource, "import { Sales_CreateWidget } from './Sales_CreateWidget.proxy.js';\nimport { Sales_GetWidgets } from './Sales_GetWidgets.proxy.js';\nimport type { Widget } from './Widget.proxy.js';\nnew Sales_CreateWidget().execute('wrong');\nconst result: number = ({} as Awaited<ReturnType<Sales_CreateWidget['execute']>>).response!;\nconst widget: Widget = { id: 1, name: 'wrong' };\nconst queryData: string = ({} as Awaited<ReturnType<Sales_GetWidgets['perform']>>).data;\nvoid result; void widget; void queryData;\n");
    const negative = await compile(dir, true);
    assert.equal(negative.error, undefined);
    assert.notEqual(negative.status, 0);
    assert.match(negative.stdout, /TS2345/); // The real SDK's execute signature, not an untyped shim.
    assert.match(negative.stdout, /TS2322/); // DTO, response and query data remain typed.
    await server.dispose();
});

for (const kind of ['express', 'fastify', 'hono']) test(`generated published client against live ${kind} host`, async () => {
    const fixtureState = fixture();
    const dir = await scratch(); const output = join(dir, 'src'); await mkdir(output);
    await generateClient(exportClientManifest(fixtureState.server), output);
    await compile(dir);
    const { Sales_CreateWidget } = await import(pathToFileURL(join(dir, 'dist/Sales_CreateWidget.proxy.js')));
    const { Sales_GetWidgets } = await import(pathToFileURL(join(dir, 'dist/Sales_GetWidgets.proxy.js')));
    const { Widget } = await import(pathToFileURL(join(dir, 'dist/Widget.proxy.js')));
    const listening = await host(kind, fixtureState.server);
    try {
        const command = new Sales_CreateWidget(); command.setOrigin(listening.origin);
        command.setHttpHeadersCallback(() => ({ Authorization: 'Bearer secret' }));
        assert.equal((await command.validate()).isValid, false);
        assert.equal(fixtureState.count(), 0);
        command.name = 'Ada';
        assert.equal((await command.validate()).isSuccess, true);
        assert.equal(fixtureState.count(), 0);
        assert.equal(command.roles[0], 'writer');
        const saved = await command.execute();
        assert.equal(saved.isSuccess, true, JSON.stringify(saved));
        assert.ok(saved.response instanceof Widget);
        assert.deepEqual([saved.response.id, saved.response.name], ['1', 'Ada']);
        const query = new Sales_GetWidgets(); query.setOrigin(listening.origin);
        query.setHttpHeadersCallback(() => ({ Authorization: 'Bearer secret' }));
        assert.equal(query.queryName, 'Sales.GetWidgets');
        assert.equal((await query.perform()).isSuccess, false);
        query.paging = new Paging(0, 10); query.sorting = new Sorting('name', SortDirection.ascending);
        const found = await query.perform({ term: 'Ada' });
        assert.equal(found.isSuccess, true, JSON.stringify(found));
        assert.ok(found.data[0] instanceof Widget);
        assert.equal(found.data[0].name, 'Ada');
        assert.equal(found.paging.totalItems, 1);
        command.name = 'AdaZoe';
        assert.equal((await command.execute()).isSuccess, true);
        query.paging = new Paging(0, 1); query.sorting = new Sorting('name', SortDirection.descending);
        const sorted = await query.perform({ term: 'Ada' });
        assert.equal(sorted.isSuccess, true, JSON.stringify(sorted));
        assert.equal(sorted.data[0].name, 'AdaZoe');
        assert.equal(sorted.paging.totalItems, 2);
        query.paging = new Paging(0, 10); query.sorting = new Sorting('name', SortDirection.ascending);
        query.setHttpMethod(QueryHttpMethod.Query);
        const structured = await query.perform({ term: 'Ada', optional: false });
        assert.equal(structured.isSuccess, true, JSON.stringify(structured));
        assert.equal(structured.data[0].name, 'Ada');
        const denied = new Sales_CreateWidget(); denied.name = 'Denied'; denied.setOrigin(listening.origin);
        assert.equal((await denied.execute()).isAuthorized, false);
        const deniedQuery = new Sales_GetWidgets(); deniedQuery.setOrigin(listening.origin);
        assert.equal((await deniedQuery.perform({ term: 'Ada' })).isAuthorized, false);
        assert.equal(fixtureState.count(), 2);
        fixtureState.invalid();
        command.name = 'PRIVATE ERROR DETAIL';
        const failed = await command.execute();
        assert.equal(failed.isSuccess, false);
        assert.equal(failed.response, undefined);
        assert.doesNotMatch(JSON.stringify(failed), /PRIVATE ERROR DETAIL/);
        fixtureState.invalidQuery();
        const failedQuery = await query.perform({ term: 'Ada' });
        assert.equal(failedQuery.isSuccess, false);
        assert.doesNotMatch(JSON.stringify(failedQuery), /PRIVATE QUERY DETAIL/);
    } finally { await listening.close(); await fixtureState.server.dispose(); }
});

for (const kind of ['express', 'fastify', 'hono']) test(`safe numbers, booleans, enums, homogeneous arrays and explicit void use the published ${kind} client wire`, async () => {
    let received;
    const server = new ArcServer({
        commands: [
            defineCommand({ name: 'RecordValues', schema: z.object({ flag: z.boolean(), count: z.number().safe(), level: z.enum(['a', 'b']), labels: z.array(z.string()), states: z.array(z.enum(['a', 'b'])), note: z.string().optional() }),
                clientOutput: { output: { kind: 'void' } }, handle: input => { received = input; } }),
            defineCommand({ name: 'ReturnFalse', schema: z.object({}), clientOutput: { output: { kind: 'boolean' } }, handle: () => false }),
            defineCommand({ name: 'ReturnZero', schema: z.object({}), clientOutput: { output: { kind: 'number' } }, handle: () => 0 }),
            defineCommand({ name: 'ReturnEmpty', schema: z.object({}), clientOutput: { output: { kind: 'string' } }, handle: () => '' }),
            defineCommand({ name: 'ReturnDetails', schema: z.object({}), clientOutput: { output: { kind: 'dto', name: 'Details', fields: [
                { name: 'title', type: string }, { name: 'tags', type: { kind: 'array', element: { kind: 'enum', values: ['a', 'b'] } } },
                { name: 'state', type: { kind: 'enum', values: ['a', 'b'] } }, { name: 'note', type: string, optional: true }
            ] } }, handle: () => ({ title: 'ok', tags: ['a', 'b'], state: 'a' }) })
        ],
        queries: [
            defineQuery({ name: 'ReadValues', schema: z.object({ ids: z.array(z.number().safe()) }), clientOutput: { output: { kind: 'array', element: { kind: 'boolean' } } },
                perform: ({ ids }) => ids.map(id => id !== 0) }),
            defineQuery({ name: 'ReadOne', schema: z.object({}), clientOutput: { output: widget }, perform: () => ({ id: '1', name: 'Ada' }) }),
            defineQuery({ name: 'ReadStates', schema: z.object({}), clientOutput: { output: { kind: 'array', element: { kind: 'enum', values: ['a', 'b'] } } }, perform: () => ['a', 'b'] })
        ]
    });
    const dir = await scratch(); const output = join(dir, 'src'); await mkdir(output);
    await generateClient(exportClientManifest(server), output); await compile(dir);
    const { RecordValues } = await import(pathToFileURL(join(dir, 'dist/RecordValues.proxy.js')));
    const { ReadValues } = await import(pathToFileURL(join(dir, 'dist/ReadValues.proxy.js')));
    const { ReadOne } = await import(pathToFileURL(join(dir, 'dist/ReadOne.proxy.js')));
    const { ReadStates } = await import(pathToFileURL(join(dir, 'dist/ReadStates.proxy.js')));
    const { Widget } = await import(pathToFileURL(join(dir, 'dist/Widget.proxy.js')));
    const { ReturnFalse } = await import(pathToFileURL(join(dir, 'dist/ReturnFalse.proxy.js')));
    const { ReturnZero } = await import(pathToFileURL(join(dir, 'dist/ReturnZero.proxy.js')));
    const { ReturnEmpty } = await import(pathToFileURL(join(dir, 'dist/ReturnEmpty.proxy.js')));
    const { ReturnDetails } = await import(pathToFileURL(join(dir, 'dist/ReturnDetails.proxy.js')));
    const { Details } = await import(pathToFileURL(join(dir, 'dist/Details.proxy.js')));
    const listening = await host(kind, server);
    try {
        const command = new RecordValues(); command.setOrigin(listening.origin);
        Object.assign(command, { flag: false, count: 0, level: 'a', labels: ['one'], states: ['a', 'b'] });
        const saved = await command.execute();
        assert.equal(saved.isSuccess, true, JSON.stringify(saved));
        assert.equal(saved.response, undefined);
        assert.deepEqual(received, { flag: false, count: 0, level: 'a', labels: ['one'], states: ['a', 'b'] });
        for (const [Proxy, expected] of [[ReturnFalse, false], [ReturnZero, 0], [ReturnEmpty, '']]) {
            const instance = new Proxy(); instance.setOrigin(listening.origin);
            const result = await instance.execute();
            assert.equal(result.isSuccess, true, JSON.stringify(result));
            assert.equal(result.response, expected);
        }
        const details = new ReturnDetails(); details.setOrigin(listening.origin);
        const returnedDetails = await details.execute();
        assert.equal(returnedDetails.isSuccess, true, JSON.stringify(returnedDetails));
        assert.ok(returnedDetails.response instanceof Details);
        assert.deepEqual(returnedDetails.response.tags, ['a', 'b']);
        assert.equal(returnedDetails.response.state, 'a');
        assert.equal(returnedDetails.response.note, undefined);
        const query = new ReadValues(); query.setOrigin(listening.origin);
        assert.deepEqual((await query.perform({ ids: [0, 1] })).data, [false, true]);
        query.setHttpMethod(QueryHttpMethod.Query);
        assert.deepEqual((await query.perform({ ids: [0, 1] })).data, [false, true]);
        const one = new ReadOne(); one.setOrigin(listening.origin);
        const result = await one.perform();
        assert.equal(result.isSuccess, true, JSON.stringify(result));
        assert.ok(result.data instanceof Widget);
        assert.equal(result.data.name, 'Ada');
        const states = new ReadStates(); states.setOrigin(listening.origin);
        assert.deepEqual((await states.perform()).data, ['a', 'b']);
    } finally { await listening.close(); await server.dispose(); }
});

test('owned replacements retain mode, no-op retains bytes, and partial publication reports committed paths', async () => {
    const { server } = fixture();
    const manifest = exportClientManifest(server);
    const dir = await scratch(); const output = join(dir, 'src'); await mkdir(output);
    await generateClient(manifest, output);
    const first = join(output, 'Sales_CreateWidget.proxy.ts');
    const original = await readFile(first, 'utf8');
    await chmod(first, 0o640);
    await writeFile(first, original + '\n// changed\n');
    assert.deepEqual(await generateClient(manifest, output), [first]);
    assert.equal((await lstat(first)).mode & 0o777, 0o640);
    assert.deepEqual(await generateClient(manifest, output), []);
    assert.equal((await lstat(join(output, 'Widget.proxy.ts'))).mode & 0o777, 0o666 & ~process.umask());
    const maskedDir = await scratch(); const maskedOutput = join(maskedDir, 'src'); await mkdir(maskedOutput);
    const priorUmask = process.umask(0o027);
    try {
        await generateClient(manifest, maskedOutput);
        assert.equal((await lstat(join(maskedOutput, 'Widget.proxy.ts'))).mode & 0o777, 0o640);
    } finally { process.umask(priorUmask); }
    const raceDir = await scratch(); const raceOutput = join(raceDir, 'src'); await mkdir(raceOutput);
    const reduced = { ...manifest, operations: Array.from({ length: 40 }, (_, index) => ({ ...manifest.operations[0], id: `A${index.toString().padStart(2, '0')}`, route: `/api/a${index}` })) };
    const raced = join(raceOutput, 'A00.proxy.ts');
    const changed = join(raceOutput, 'Widget.proxy.ts');
    const worker = new Worker(`const { parentPort, workerData } = require('node:worker_threads');
        const { existsSync, writeFileSync } = require('node:fs');
        parentPort.postMessage('ready');
        while (!existsSync(workerData.first)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
        writeFileSync(workerData.last, 'HANDWRITTEN', { flag: 'wx' });
        parentPort.postMessage('written');`, { eval: true, workerData: { first: raced, last: changed } });
    try {
        await new Promise(resolve => worker.once('message', resolve));
        await assert.rejects(generateClient(reduced, raceOutput), /partially committed: .*A00.proxy.ts/);
        assert.equal(await readFile(changed, 'utf8'), 'HANDWRITTEN');
        assert.match(await readFile(raced, 'utf8'), /Generated by/);
        assert.deepEqual((await readdir(raceOutput)).filter(file => file.endsWith('.tmp')), []);
    } finally { await worker.terminate(); await server.dispose(); }
});

test('concurrent edits to owned files abort generation rather than overwriting them', async () => {
    const { server } = fixture(); const base = exportClientManifest(server);
    const original = { ...base, operations: Array.from({ length: 40 }, (_, index) => ({ ...base.operations[0], id: `A${index.toString().padStart(2, '0')}`, route: `/api/a${index}` })) };
    const modified = { ...original, operations: original.operations.map(operation => ({ ...operation, route: `${operation.route}-new` })) };
    const dir = await scratch(); const output = join(dir, 'src'); await mkdir(output);
    await generateClient(original, output);
    const first = join(output, 'A00.proxy.ts');
    const old = await readFile(first, 'utf8');
    const worker = new Worker(`const { parentPort, workerData } = require('node:worker_threads');
        const { readdirSync, writeFileSync } = require('node:fs');
        parentPort.postMessage('ready');
        while (!readdirSync(workerData.root).some(file => file.endsWith('.tmp'))) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
        writeFileSync(workerData.first, workerData.old + '\\n// concurrent owner edit\\n');`,
    { eval: true, workerData: { root: output, first, old } });
    try {
        await new Promise(resolve => worker.once('message', resolve));
        await assert.rejects(generateClient(modified, output), /changed during generation/);
        assert.match(await readFile(first, 'utf8'), /concurrent owner edit/);
        assert.deepEqual((await readdir(output)).filter(file => file.endsWith('.tmp')), []);
    } finally { await worker.terminate(); await server.dispose(); }
});

test('enum arrays have array precedence in every generated type position', async () => {
    const enumArray = { kind: 'array', element: { kind: 'enum', values: ['a', 'b'] } };
    const manifest = { product: '@cratis/arc.core', version: 1, operations: [
        { id: 'PutStates', kind: 'command', route: '/states', methods: ['POST'], roles: [], authentication: 'default', dynamicAuthorization: false, input: [{ name: 'states', type: enumArray }], output: { kind: 'dto', name: 'States', fields: [{ name: 'states', type: enumArray }] } },
        { id: 'GetStates', kind: 'query', route: '/get-states', methods: ['GET'], queryName: 'GetStates', roles: [], authentication: 'default', dynamicAuthorization: false, input: [{ name: 'states', type: enumArray }], output: enumArray }
    ] };
    const dir = await scratch(); const output = join(dir, 'src'); await mkdir(output);
    await generateClient(manifest, output); await compile(dir);
    for (const file of ['PutStates', 'GetStates', 'States']) assert.match(await readFile(join(output, `${file}.proxy.ts`), 'utf8'), /\("a" \| "b"\)\[\]/);
    await writeFile(join(output, 'wrong.ts'), "import type { PutStates } from './PutStates.proxy.js';\nimport type { GetStates } from './GetStates.proxy.js';\nimport type { States } from './States.proxy.js';\nconst command: PutStates['states'] = 'a';\nconst dto: States['states'] = 'a';\nconst query: GetStates['defaultValue'] = 'a';\nvoid command; void dto; void query;\n");
    const negative = await compile(dir, true);
    assert.equal(negative.error, undefined);
    assert.notEqual(negative.status, 0);
    assert.equal((negative.stdout.match(/TS2322/g) ?? []).length, 3, negative.stdout);
});

test('serialized output snapshot is validated once and is the response before scope completion', async () => {
    const widgetOutput = { kind: 'dto', name: 'WireWidget', fields: [{ name: 'id', type: string }] };
    let commandValue; let queryValue; let pageValue; let tamper = false; const completed = [];
    const server = new ArcServer({ commands: [defineCommand({ name: 'WireCommand', schema: z.object({}), clientOutput: { output: widgetOutput },
        handle: () => commandValue, scopes: [() => ({ begin: () => undefined, complete: (_context, result) => { completed.push(result.isSuccess); if (tamper && result.response) result.response.id = 3; } })] })],
    queries: [defineQuery({ name: 'WireQuery', schema: z.object({}), clientOutput: { output: { kind: 'array', element: widgetOutput } }, perform: () => queryValue }),
        defineQuery({ name: 'WirePage', schema: z.object({}), clientOutput: { output: { kind: 'array', element: widgetOutput } }, perform: () => queryPage(pageValue, pageValue.length) })] });
    const context = { correlationId: 'wire', allowedSeverity: 2, signal: new AbortController().signal };
    const dir = await scratch(); const output = join(dir, 'src'); await mkdir(output);
    await generateClient(exportClientManifest(server), output); await compile(dir);
    const { WireCommand } = await import(pathToFileURL(join(dir, 'dist/WireCommand.proxy.js')));
    const { WireQuery } = await import(pathToFileURL(join(dir, 'dist/WireQuery.proxy.js')));
    const listening = await host('express', server);
    try {
        const command = new WireCommand(); command.setOrigin(listening.origin);
        const query = new WireQuery(); query.setOrigin(listening.origin);
        let reads = 0;
        commandValue = { get id() { reads++; return reads === 1 ? 'first' : undefined; } };
        const success = await command.execute();
        assert.equal(success.isSuccess, true);
        assert.equal(success.response.id, 'first');
        assert.equal(reads, 1);
        assert.deepEqual(completed, [true]);
        let calls = 0;
        commandValue = { id: 'public', toJSON() { calls++; return { id: 3, secret: 'PRIVATE' }; } };
        const failed = await command.execute();
        assert.equal(failed.isSuccess, false);
        assert.equal(failed.response, undefined);
        assert.doesNotMatch(JSON.stringify(failed), /PRIVATE/);
        assert.equal(calls, 1);
        assert.deepEqual(completed, [true, false]);
        commandValue = { id: 'public', toJSON() { calls++; return { id: 'wire' }; } };
        const normalized = await command.execute();
        assert.equal(normalized.response.id, 'wire');
        assert.equal(calls, 2);
        tamper = true;
        assert.equal((await command.execute()).isSuccess, false);
        tamper = false;
        queryValue = new Array(1);
        assert.equal((await query.perform()).isSuccess, false);
        queryValue = [{ id: 'public' }];
        queryValue.toJSON = () => [{ id: 2, secret: 'PRIVATE' }];
        const badArray = await query.perform();
        assert.equal(badArray.isSuccess, false);
        assert.doesNotMatch(JSON.stringify(badArray), /PRIVATE/);
        pageValue = [{ id: 'a' }];
        pageValue.toJSON = () => [{ id: 3 }];
        assert.equal((await server.performQuery('WirePage', {}, context)).isSuccess, false);
        queryValue = [{ id: 'first' }];
        let itemReads = 0;
        Object.defineProperty(queryValue[0], 'id', { enumerable: true, get() { itemReads++; return itemReads === 1 ? 'first' : undefined; } });
        const goodQuery = await query.perform();
        assert.equal(goodQuery.isSuccess, true);
        assert.equal(goodQuery.data[0].id, 'first');
        assert.equal(itemReads, 1);
    } finally { await listening.close(); await server.dispose(); }
});

test('missing, unsafe, contradictory, unsupported manifests and output hazards fail before writing owned files', async () => {
    const { server } = fixture(); const manifest = exportClientManifest(server);
    const dir = await scratch(); const output = join(dir, 'src'); await mkdir(output);
    const bad = [
        { ...manifest, version: 2 },
        { ...manifest, operations: [] },
        { ...manifest, operations: [{ ...manifest.operations[0], output: { kind: 'dto', name: 'Large', fields: Array.from({ length: 128 }, (_, index) => ({ name: `field${index}`, type: { kind: 'enum', values: Array.from({ length: 16 }, (_, value) => `${value}${'x'.repeat(1020)}`) } })) } }] },
        ...['page', 'PageSize', 'SORTBY', 'sortDirection'].map(name => ({ ...manifest, operations: [{ ...manifest.operations[1], input: [{ name, type: string }] }] })),
        ...['Number', 'String', 'Boolean', 'Object', 'Symbol', 'Reflect', 'TypeError', 'Command', 'QueryFor', 'field', 'PropertyDescriptor', 'undefined', 'eval', 'arguments', 'string', 'number', 'boolean', 'object', 'symbol', 'bigint', 'any', 'unknown', 'never'].map(id => ({ ...manifest, operations: [{ ...manifest.operations[0], id }] })),
        ...['String', 'Number', 'field', 'QueryFor', 'Reflect', 'eval', 'arguments', 'string', 'number', 'boolean', 'object', 'symbol', 'bigint', 'any', 'unknown', 'never'].map(name => ({ ...manifest, operations: [{ ...manifest.operations[0], output: { kind: 'dto', name, fields: [] } }] })),

        { ...manifest, operations: [{ ...manifest.operations[0], id: 'A', output: { kind: 'dto', name: 'B', fields: [] } }, { ...manifest.operations[0], id: 'B', route: '/other', output: { kind: 'void' } }] },
        { ...manifest, operations: [{ ...manifest.operations[0], output: { kind: 'unknown' } }] },
        { ...manifest, operations: [{ ...manifest.operations[0], output: { kind: 'dto', name: '../Escape', fields: [] } }] },
        { ...manifest, operations: [{ ...manifest.operations[0], route: '/../escape' }] },
        { ...manifest, operations: [{ ...manifest.operations[0], methods: ['GET'] }] },
        { ...manifest, operations: [manifest.operations[0], manifest.operations[0]] },
        { ...manifest, operations: [{ ...manifest.operations[0], output: { kind: 'array', element: { kind: 'array', element: string } } }] },
        { ...manifest, operations: [{ ...manifest.operations[0], input: [{ name: 'x', type: { kind: 'dto', name: 'Unsafe', fields: [] } }] }] },
        { ...manifest, operations: [{ ...manifest.operations[1], output: { kind: 'boolean' } }] },
        { ...manifest, operations: [{ ...manifest.operations[0], output: { kind: 'dto', name: 'class', fields: [] } }] },
        { ...manifest, operations: [{ ...manifest.operations[0], output: { kind: 'dto', name: 'CON', fields: [] } }] },
        { ...manifest, operations: [{ ...manifest.operations[0], id: 'Widget', route: '/api/a' }, { ...manifest.operations[0], id: 'widget', route: '/api/b' }] },
        { ...manifest, startup: './startup.mjs' },
        { ...manifest, operations: [{ ...manifest.operations[0], input: [{ name: 'execute', type: string }] }] },
        { ...manifest, operations: [{ ...manifest.operations[0], output: { kind: 'dto', name: 'ISales_CreateWidget', fields: [] } }] },
        { ...manifest, operations: [{ ...manifest.operations[0], output: { kind: 'enum', values: ['a"; throw Error(\"injection\"); //'] } }] }
    ];
    for (const invalid of bad.slice(0, -1)) await assert.rejects(generateClient(invalid, output), /Client manifest|collision|conflicts/);
    // Field names are property keys, not generated class bindings.
    for (const name of ['eval', 'arguments', 'string', 'object', 'any']) {
        assert.ok(renderClientManifest({ ...manifest, operations: [{ ...manifest.operations[0], input: [{ name, type: string }] }] }).size > 0);
        assert.ok(renderClientManifest({ ...manifest, operations: [{ ...manifest.operations[0], output: { kind: 'dto', name: 'Valid', fields: [{ name, type: string }] } }] }).size > 0);
    }
    const escaped = renderClientManifest(bad.at(-1));
    assert.match(escaped.get('Sales_CreateWidget.proxy.ts'), /a\\\"; throw Error/);
    assert.deepEqual(await readdir(output), []);
    const marker = join(dir, 'startup-ran');
    const startup = join(dir, 'startup.mjs');
    await writeFile(startup, `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'bad');`);
    const malicious = join(dir, 'malicious.json');
    await writeFile(malicious, JSON.stringify({ ...manifest, startup }));
    const rejected = spawnSync(process.execPath, [join(root, 'Source/Tools/ProxyGenerator/dist/cli.js'), malicious, output], { encoding: 'utf8' });
    assert.equal(rejected.error, undefined);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /Client manifest root: unsupported product, version or structure/);
    await assert.rejects(readFile(marker), { code: 'ENOENT' });
    assert.deepEqual(await readdir(output), []);
    const oversized = join(dir, 'oversized.json');
    await writeFile(oversized, ' '.repeat(4 * 1024 * 1024 + 1));
    const capped = spawnSync(process.execPath, [join(root, 'Source/Tools/ProxyGenerator/dist/cli.js'), oversized, output], { encoding: 'utf8' });
    assert.equal(capped.error, undefined);
    assert.notEqual(capped.status, 0);
    assert.match(capped.stderr, /4 MiB input limit/);
    assert.deepEqual(await readdir(output), []);
    const missing = new ArcServer({ commands: [defineCommand({ name: 'Missing', schema: z.object({}), handle: () => undefined })] });
    assert.throws(() => exportClientManifest(missing), /missing explicit client output/);
    await missing.dispose();
    assert.throws(() => new ArcServer({ commands: [defineCommand({ name: 'Refined', clientOutput: { output: { kind: 'void' } }, schema: z.object({ value: z.string().refine(() => { throw Error('EVALUATED'); }) }), handle: () => undefined })] }), /field refinements are unsupported/);
    let defaults = 0;
    assert.throws(() => new ArcServer({ commands: [defineCommand({ name: 'Default', clientOutput: { output: { kind: 'void' } }, schema: z.object({ value: z.string().default(() => { defaults++; return 'x'; }) }), handle: () => undefined })] }), /Zod defaults may execute user functions/);
    assert.equal(defaults, 0);
    const file = join(output, 'Widget.proxy.ts'); await writeFile(file, 'HANDWRITTEN');
    await assert.rejects(generateClient(manifest, output), /Refusing to overwrite handwritten/);
    assert.equal(await readFile(file, 'utf8'), 'HANDWRITTEN');
    const other = await scratch(); await symlink(other, join(output, 'Sales_CreateWidget.proxy.ts'));
    await assert.rejects(generateClient(manifest, output), /not a regular file/);
    await assert.rejects(generateClient(manifest, join(dir, 'absent')), /ENOENT|output root/);
    const linkedRoot = join(dir, 'linked'); await symlink(output, linkedRoot);
    await assert.rejects(generateClient(manifest, linkedRoot), /real directory/);
    assert.throws(() => new ArcServer({ queries: [defineQuery({ name: 'Reserved', schema: z.object({ PageSize: z.string() }), clientOutput: { output: widget }, perform: () => ({ id: '1', name: 'x' }) })] }), /reserved GET query argument/);
    assert.throws(() => new ArcServer({ commands: [defineCommand({ name: 'Nullable', clientOutput: { output: { kind: 'void' } }, schema: z.object({ value: z.string().nullable() }), handle: () => undefined })] }), /nullable/);
    await unlink(file);
    await unlink(join(output, 'Sales_CreateWidget.proxy.ts'));
    await unlink(linkedRoot);
    await server.dispose();
});

test('scratch cleanup refuses symlinks, foreign files and roots from earlier runs', async () => {
    const dir = await scratch();
    const sentinel = join(dir, 'unrelated.txt');
    await writeFile(sentinel, 'preserve');
    await assert.rejects(cleanupScratch(dir), /foreign file/);
    assert.equal(await readFile(sentinel, 'utf8'), 'preserve');
    await unlink(sentinel);
    const linked = join(dir, 'node_modules');
    await symlink(join(root, 'node_modules'), linked);
    await assert.rejects(cleanupScratch(dir), /symlink/);
    assert.equal((await lstat(join(root, 'node_modules'))).isDirectory(), true);
    await unlink(linked);
    await assert.rejects(cleanupScratch(join(root, '.ai-work/client-generation-from-before')), /not created by this test run/);
});
