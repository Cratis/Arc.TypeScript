// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ArcApplication } from '@cratis/arc.core';
import { generateFromSource } from '@cratis/arc.proxygenerator';
import { clientTest, scratch } from './scratch.mjs';
import { observableHost } from './observableHost.mjs';

const root = resolve(import.meta.dirname, '../..');

for (const kind of ['express', 'fastify', 'hono']) clientTest(`published client round trips a registered derivative on ${kind}`, async () => {
    const folder = await scratch();
    const output = join(folder, 'src');
    await mkdir(output);
    await generateFromSource({
        project: join(root, 'ContractTests/Http/modelBound/tsconfig.json'),
        artifacts: join(root, 'ContractTests/Http/modelBound/polymorphic'), output,
        useProxyFileSuffix: true, jsImportSpecifiers: true
    });
    const commandSource = await readFile(join(output, 'Fixtures/EchoNotice.proxy.ts'), 'utf8');
    assert.match(commandSource, /BaseNotice/);
    await writeFile(join(folder, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
        target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
        skipLibCheck: false, noEmitOnError: true, outDir: './dist', rootDir: './src', types: ['node']
    }, include: ['src/**/*.ts'] }));
    execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', join(folder, 'tsconfig.json')], { cwd: root });
    const generated = name => import(pathToFileURL(join(folder, 'dist/Fixtures', name)).href);
    const { EchoNotice: ClientEcho } = await generated('EchoNotice.proxy.js');
    const { UrgentNotice: ClientUrgent } = await import(pathToFileURL(join(folder, 'dist/UrgentNotice.proxy.js')).href);
    const { EchoNotice } = await import(join(root, 'ContractTests/Http/modelBound/dist/polymorphic/EchoNotice.js'));
    const builder = ArcApplication.createBuilder();
    builder.add(EchoNotice);
    const application = await builder.build();
    const listening = await observableHost(kind, application.server);
    try {
        const command = new ClientEcho();
        command.setOrigin(listening.origin);
        const urgent = new ClientUrgent(); urgent.title = 'hello'; urgent.priority = 3;
        command.notice = urgent;
        const result = await command.execute();
        assert.equal(result.isSuccess, true, JSON.stringify(result));
        assert.equal(result.response.notice instanceof ClientUrgent, true);
        assert.equal(result.response.notice.title, 'hello');
        assert.equal(result.response.notice.priority, 3);
    } finally { await listening.close(); await application.dispose(); }
});
