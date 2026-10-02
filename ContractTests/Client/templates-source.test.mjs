// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ArcApplication } from '@cratis/arc.core';
import '@cratis/arc.mongodb';
import { clientTest as test, scratch } from './scratch.mjs';

const root = resolve(import.meta.dirname, '../..');
const fixture = join(root, 'Source/Tools/ProxyGenerator/for_analyzeSource/given/templates_project');
const cli = join(root, 'Source/Tools/ProxyGenerator/dist/cli.js');
const compiler = join(root, 'node_modules/.bin/tsc');

function run(command, arguments_) {
    const result = spawnSync(command, arguments_, { cwd: root, encoding: 'utf8', timeout: 30000 });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result;
}

async function templateProject() {
    // Keep all test products under scratch's recognized src tree; inside it the layout is the template's.
    const directory = join(await scratch(), 'src');
    await cp(fixture, directory, { recursive: true });
    const project = join(directory, 'src/tsconfig.json');
    const artifacts = join(directory, 'src/Features');
    const output = join(directory, 'build/generated/arc-proxies');
    const metadata = join(artifacts, 'generatedMetadata.ts');
    await mkdir(output, { recursive: true });
    // Cratis/Templates#61: dedicated, unsuffixed flat output plus server metadata in the discovery root.
    const arguments_ = [cli, '--project', project, '--artifacts', artifacts, '--output', output,
        '--metadata', metadata, '--segments-to-skip', '3'];
    return { directory, project, artifacts, output, metadata, arguments_ };
}

async function snapshot(output) {
    const files = (await readdir(output)).sort();
    return Promise.all(files.map(async file => [file, await readFile(join(output, file))]));
}

test('dotnet new cratis TypeScript slice preserves the flat proxy, metadata, route and frontend contract', async () => {
    const { directory, project, output, metadata, arguments_ } = await templateProject();
    run(process.execPath, arguments_);
    assert.deepEqual((await readdir(output)).sort(), ['All.ts', 'Listing.ts', 'Register.ts', 'index.ts']);
    const barrel = await readFile(join(output, 'index.ts'), 'utf8');
    assert.match(barrel, /export \* from '\.\/Register';/);
    assert.match(barrel, /export \* from '\.\/All';/);
    assert.match(barrel, /export \* from '\.\/Listing';/);
    assert.doesNotMatch(barrel, /Registered|RegistrationReactor|SomeId|SomeName/);
    const register = await readFile(join(output, 'Register.ts'), 'utf8');
    const all = await readFile(join(output, 'All.ts'), 'utf8');
    const listing = await readFile(join(output, 'Listing.ts'), 'utf8');
    assert.match(register, /extends Command<IRegister>/);
    assert.match(register, /super\(Object, false\)/);
    assert.match(register, /get id\(\): string/);
    assert.match(register, /get name\(\): string/);
    assert.doesNotMatch(register, /Registered|RegistrationReactor/);
    assert.match(all, /extends ObservableQueryFor<Listing\[\]>/);
    assert.match(listing, /id!: string/);
    assert.match(listing, /name!: string/);
    const metadataBytes = await readFile(metadata);
    assert.match(metadataBytes.toString(), /handleResult: \{ cardinality: 'void', nullable: false \}, handleValueResult: \{ cardinality: 'one', nullable: false \}/);
    const before = await snapshot(output);
    const regenerated = run(process.execPath, arguments_);
    assert.match(regenerated.stdout, /Generated 0 changed file\(s\)/);
    assert.deepEqual(await snapshot(output), before);
    assert.deepEqual(await readFile(metadata), metadataBytes);
    run(process.execPath, [...arguments_, '--check-metadata']);

    // Compile the real TC39 backend and its generated metadata, then discover the same artifacts on the server.
    run(compiler, ['-p', project]);
    const { metadata: generatedMetadata } = await import(pathToFileURL(join(directory, 'dist/Features/generatedMetadata.js')).href);
    const { Listing } = await import(pathToFileURL(join(directory, 'dist/Features/SomeModule/SomeFeature/Listing/Listing.js')).href);
    const builder = ArcApplication.createBuilder({ configuration: false, introspection: { enabled: false },
        tenancy: { resolve: () => 'Default' }, generatedApis: { routePrefix: 'api', segmentsToSkipForRoute: 3 } });
    builder.useGeneratedMetadata(generatedMetadata);
    // Registration and route mapping do not open a database connection; Templates owns the live smoke test.
    builder.withChronicle({ connectionString: 'chronicle://localhost:35000', eventStore: 'Template' });
    builder.withMongoDB({ server: 'mongodb://localhost:27017', database: 'Template', readModels: [Listing] });
    await builder.discover(pathToFileURL(join(directory, 'dist/Features/')));
    const application = await builder.build();
    try {
        assert.deepEqual([...application.server.routes.keys()].sort(), ['/api/listings', '/api/register', '/api/register/validate']);
        for (const [source, route, name] of [
            [register, '/api/register', 'SomeModule.SomeFeature.Registration.Register'],
            [all, '/api/listings', 'SomeModule.SomeFeature.Listing.Listing.all']
        ]) {
            assert.ok(source.includes(`'${route}'`), `Missing proxy route ${route}`);
            assert.equal(application.server.routes.get(route).fullyQualifiedName, name);
            if (source === all) assert.ok(source.includes(`queryName: string = '${name}'`), `Missing proxy query name ${name}`);
        }
    } finally { await application.stop(); }

    // Compiler options from Cratis/Templates/Templates/Cratis.Kotlin/.frontend/tsconfig.json.
    // Only include/paths adapt the layout; skipLibCheck stays stricter than the template.
    const frontend = join(directory, 'frontend');
    await mkdir(frontend);
    await writeFile(join(frontend, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: false,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: false,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        isolatedModules: true,
        moduleDetection: 'force',
        noEmit: true,
        jsx: 'react-jsx',
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        paths: { 'Api/*': ['../build/generated/arc-proxies/*'] }
    }, include: ['*.ts', '../build/generated/arc-proxies/**/*.ts'] }));
    await writeFile(join(frontend, 'Template.ts'), `import { Register } from 'Api/Register';
import { All } from 'Api/All';
import type { Listing } from 'Api/Listing';
const [command, setValues] = Register.use();
setValues({ id: 'some-id', name: 'Cratis' });
void command.execute();
const [result] = All.use();
const listings: Listing[] = result.data;
const names: string[] = listings.map(listing => listing.name);
void names;
`);
    run(compiler, ['-p', join(frontend, 'tsconfig.json')]);
});

test('template regeneration removes a deleted command proxy and its barrel export', async () => {
    const { artifacts, output, metadata, arguments_ } = await templateProject();
    run(process.execPath, arguments_);
    const commandImport = /import \{ Register as _arc\d+ \} from "\.\/SomeModule\/SomeFeature\/Registration\/Registration\.js";/;
    const commandSignature = /\\"name\\":\\"Register\\"/;
    const originalMetadata = await readFile(metadata, 'utf8');
    assert.match(originalMetadata, commandImport);
    assert.match(originalMetadata, commandSignature);
    const registration = join(artifacts, 'SomeModule/SomeFeature/Registration/Registration.ts');
    const original = await readFile(registration, 'utf8');
    const removed = original.replace(/@command\(\)[\s\S]*?\n}\n/, '');
    assert.notEqual(removed, original, 'The fixture must contain the command being removed');
    await writeFile(registration, removed);
    run(process.execPath, arguments_);
    await assert.rejects(readFile(join(output, 'Register.ts')), { code: 'ENOENT' });
    assert.deepEqual((await readdir(output)).sort(), ['All.ts', 'Listing.ts', 'index.ts']);
    const barrel = await readFile(join(output, 'index.ts'), 'utf8');
    assert.doesNotMatch(barrel, /Register/);
    assert.match(barrel, /export \* from '\.\/All';/);
    assert.match(barrel, /export \* from '\.\/Listing';/);
    const regeneratedMetadata = await readFile(metadata, 'utf8');
    assert.doesNotMatch(regeneratedMetadata, commandImport);
    assert.doesNotMatch(regeneratedMetadata, commandSignature);
    run(process.execPath, [...arguments_, '--check-metadata']);
});
