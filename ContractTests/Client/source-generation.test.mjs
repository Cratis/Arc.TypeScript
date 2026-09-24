// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Guid } from '@cratis/fundamentals';
import { Globals } from '@cratis/arc';
import { Paging, Sorting, SortDirection, resetSharedMultiplexer } from '@cratis/arc/queries';
import { ArcApplication, AuthenticationStatus } from '@cratis/arc.core';
import { generateFromSource, analyzeSource, renderSource } from '@cratis/arc.proxygenerator';
import { clientTest as test, scratch } from './scratch.mjs';
import { observableHost } from './observableHost.mjs';

const root = resolve(import.meta.dirname, '../..');
const project = join(root, 'Samples/Tasks/tsconfig.json');
const artifacts = join(root, 'Samples/Tasks/Features');
const options = { project, artifacts, useProxyFileSuffix: true, jsImportSpecifiers: true };
async function within(promise, message) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 3000); })]); }
    finally { clearTimeout(timer); }
}
async function generated(overrides = {}) {
    const directory = await scratch();
    const output = join(directory, 'src');
    await mkdir(output);
    const changed = await generateFromSource({ ...options, ...overrides, output });
    const before = await readFile(join(output, 'Tasks/Registration/RegisterTask.proxy.ts'), 'utf8');
    assert.deepEqual(await generateFromSource({ ...options, ...overrides, output }), []);
    assert.equal(await readFile(join(output, 'Tasks/Registration/RegisterTask.proxy.ts'), 'utf8'), before);
    const tsconfig = { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
        skipLibCheck: false, noEmitOnError: true, outDir: './dist', rootDir: './src', types: ['node'] }, include: ['src/**/*.ts'] };
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify(tsconfig));
    execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', join(directory, 'tsconfig.json')], { cwd: root });
    const modules = async path => import(pathToFileURL(join(directory, 'dist', path)).href);
    return { output, changed, modules };
}
test('source analyzer resolves imported decorator symbols, types, routes and stable owned output', async () => {
    const analysis = analyzeSource(project, artifacts);
    assert.deepEqual(analysis.operations.map(item => item.name).sort(), ['RegisterTask', 'allTasks', 'observeAllTasks', 'taskById']);
    assert.equal(analysis.operations.find(item => item.name === 'RegisterTask').result.text, 'Guid');
    assert.deepEqual(analysis.recordedRules.get('Tasks.Registration.RegisterTask').map(rule => rule.kind), ['notEmpty', 'maxLength']);
    assert.ok(analysis.diagnostics.some(message => message.includes('Server-only validator rule on value')));
    const rendered = renderSource(analysis, options);
    assert.match(rendered.get('Tasks/Listing/observeAllTasks.proxy.ts'), /ObservableQueryFor<TaskItem\[\]>/);
    assert.match(rendered.get('Tasks/Listing/taskById.proxy.ts'), /\/api\/tasks\/listing\/task-by-id/);
    assert.match(rendered.get('Tasks/Registration/RegisterTask.proxy.ts'), /ruleFor\(c => c.title\).notEmpty\(\).withMessage\('A title is required'\)/);
    assert.match(renderSource(analysis).get('Tasks/Listing/taskById.ts'), /from '\.\/TaskItem'/);
    const { output } = await generated();
    assert.match(await readFile(join(output, 'Tasks/Registration/RegisterTask.proxy.ts'), 'utf8'), /propertyChanged\('title'\)/);
    const own = join(output, 'Tasks/Listing/allTasks.proxy.ts');
    await writeFile(own, (await readFile(own, 'utf8')).replace("'/api/tasks/listing/all-tasks'", "'/altered'"));
    await assert.rejects(generateFromSource({ ...options, output }), /edited file/);
    assert.ok((await readdir(join(output, 'Tasks/Listing'))).includes('TaskItem.proxy.ts'));
});

for (const kind of ['express', 'fastify', 'hono']) test(`analyzer-generated published client runs against live model-bound ${kind}`, async () => {
    const { modules } = await generated();
    const { RegisterTask } = await modules('Tasks/Registration/RegisterTask.proxy.js');
    const { allTasks } = await modules('Tasks/Listing/allTasks.proxy.js');
    const { taskById } = await modules('Tasks/Listing/taskById.proxy.js');
    const { observeAllTasks } = await modules('Tasks/Listing/observeAllTasks.proxy.js');
    const { Tasks } = await import(join(root, 'Samples/Tasks/dist/Features/Tasks/Tasks.js'));
    const builder = ArcApplication.createBuilder({ development: true, authentication: [() => ({ status: AuthenticationStatus.Authenticated,
        principal: { id: 'client', isAuthenticated: true, roles: [] } })] });
    builder.services.addSingleton(Tasks);
    await builder.discover(pathToFileURL(join(root, 'Samples/Tasks/dist/Features/')));
    const app = await builder.build();
    const listening = await observableHost(kind, app.server);
    try {
        const id = Guid.create();
        const command = new RegisterTask(); command.setOrigin(listening.origin);
        command.id = id; command.title = 'First';
        const saved = await command.execute();
        assert.equal(saved.isSuccess, true, JSON.stringify(saved));
        const list = new allTasks(); list.setOrigin(listening.origin);
        const result = await list.perform();
        assert.equal(result.isSuccess, true, JSON.stringify(result));
        assert.equal(result.data[0].title, 'First');
        list.paging = new Paging(0, 1);
        list.sorting = new Sorting('title', SortDirection.ascending);
        assert.equal((await list.perform()).paging.totalItems, 1);
        const byId = new taskById(); byId.setOrigin(listening.origin);
        assert.equal((await byId.perform({ id })).data.title, 'First');
        const observable = new observeAllTasks(); observable.setOrigin(listening.origin);
        assert.equal(observable.queryName, 'Tasks.Listing.TaskItem.observeAllTasks');
        assert.equal((await observable.perform()).data[0].title, 'First');
        const previous = { direct: Globals.queryDirectMode, mode: Globals.observableQueryTransferMode };
        Globals.queryDirectMode = false;
        Globals.observableQueryTransferMode = 'full';
        let subscription;
        try {
            const update = Promise.withResolvers();
            subscription = observable.subscribe(value => { if (value.data?.some(item => item.title === 'Second')) update.resolve(); });
            const sendUpdate = async () => {
                const next = new RegisterTask(); next.setOrigin(listening.origin);
                next.id = Guid.create(); next.title = 'Second';
                if (!(await next.execute()).isSuccess) update.reject(new Error('Hub command failed'));
            };
            const timer = setInterval(() => { void sendUpdate().catch(update.reject); }, 100);
            try { await within(update.promise, 'Hub update timed out'); }
            finally { clearInterval(timer); }
        } finally { subscription?.unsubscribe(); Globals.queryDirectMode = previous.direct; Globals.observableQueryTransferMode = previous.mode; resetSharedMultiplexer(); }
    } finally { await listening.close(); await app.stop(); }
});

test('recorded portable rules emit a typed browser validator and server-only rules report a diagnostic', async () => {
    const diagnostics = [];
    const rules = new Map([['Tasks.Registration.RegisterTask', [
        { path: ['title'], kind: 'notEmpty', args: [], message: 'Required', clientSafe: true },
        { path: ['title'], kind: 'must', args: [], clientSafe: false }
    ]]]);
    const rendered = renderSource(analyzeSource(project, artifacts), { ...options, recordedRules: rules, onDiagnostic: message => diagnostics.push(message) });
    assert.match(rendered.get('Tasks/Registration/RegisterTask.proxy.ts'), /ruleFor\(c => c.title\).notEmpty\(\).withMessage\('Required'\)/);
    assert.ok(diagnostics.some(message => message.includes('Server-only validator rule on value')));
    assert.ok(diagnostics.includes('Server-only validation rule on RegisterTask.title: must'));
    await generated({ recordedRules: rules, onDiagnostic: () => undefined });
});

test('stale owned files are removed while handwritten files remain unchanged', async () => {
    const { output } = await generated();
    const manual = join(output, 'manual.ts');
    await writeFile(manual, 'export const manual = true;\n');
    const changed = await generateFromSource({ project: join(root, 'ContractTests/Http/modelBound/tsconfig.json'),
        artifacts: join(root, 'ContractTests/Http/modelBound'), output, useProxyFileSuffix: true });
    assert.ok(changed.some(path => path.endsWith('RegisterTask.proxy.ts')));
    assert.equal(await readFile(manual, 'utf8'), 'export const manual = true;\n');
    assert.ok(!(await readdir(join(output, 'Tasks/Listing'))).includes('TaskItem.proxy.ts'));
});

test('invalid source CLI options return nonzero before writing', async () => {
    const directory = await scratch();
    const output = join(directory, 'src'); await mkdir(output);
    const result = spawnSync(process.execPath, [join(root, 'Source/Tools/ProxyGenerator/dist/cli.js'), '--project', project,
        '--artifacts', artifacts, '--output', output, '--segments-to-skip', '-1'], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.deepEqual(await readdir(output), []);
});
