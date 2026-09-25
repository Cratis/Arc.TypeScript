// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lock = readFileSync(join(root, 'yarn.lock'), 'utf8');
const packages = workspace.workspaces.filter(pattern => pattern.endsWith('/*')).flatMap(pattern => {
    const base = join(root, pattern.slice(0, -1));
    return readdirSync(base, { withFileTypes: true }).filter(entry => entry.isDirectory())
        .map(entry => join(base, entry.name)).filter(folder => existsSync(join(folder, 'package.json')));
}).map(folder => ({ folder, manifest: JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8')) }))
    .filter(({ manifest }) => manifest.private !== true);
if (packages.length !== 11) throw new Error(`Expected 11 publishable packages, found ${packages.length}`);

function run(command, args, cwd) {
    const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status ?? result.signal})`);
}

function lockedVersion(name) {
    const installed = JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
    if (name === 'typescript') {
        if (!lock.includes(`resolution: "@typescript/typescript6@npm:${installed}"`)) {
            throw new Error(`typescript alias @typescript/typescript6@${installed} is not resolved by yarn.lock`);
        }
        return `npm:@typescript/typescript6@${installed}`;
    }
    if (!lock.includes(`resolution: "${name}@npm:${installed}"`)) {
        throw new Error(`${name}@${installed} is not resolved by yarn.lock`);
    }
    return installed;
}

const forbidden = /(?:^|\/)(?:given(?:\.[^/]*)?|for_[^/]*|fixtures?|Integration|__tests__|\.ai-work)(?:\/|$)|(?:\.spec\.|\.test\.|\.tsbuildinfo$)/i;
function importsFrom(text, filename) {
    const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true,
        filename.endsWith('.d.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    const imports = [];
    function visit(node) {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            imports.push(node.moduleSpecifier.text);
        } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
            imports.push(node.argument.literal.text);
        } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
            imports.push(node.arguments[0].text);
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
    return imports;
}
function dependencyName(specifier) {
    return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
}
function inspectPackage(folder, manifest) {
    const files = readdirSync(folder, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name));
    const names = files.map(file => relative(folder, file).split(sep).join('/'));
    if (!names.includes('README.md') || !names.includes('LICENSE') || !names.includes('package.json')) {
        throw new Error(`${manifest.name}: README, LICENSE and package.json must be packed`);
    }
    if (!manifest.exports?.['.'] || !manifest.files?.includes('dist')) throw new Error(`${manifest.name}: missing exports or dist files`);
    let checked = 0;
    for (const entry of Object.values(manifest.exports)) {
        for (const target of Object.values(entry)) {
            if (typeof target !== 'string' || !names.includes(target.replace(/^\.\//, ''))) {
                throw new Error(`${manifest.name}: export target ${target} is not packed`);
            }
            checked++;
        }
    }
    for (const target of Object.values(manifest.bin ?? {})) {
        if (!names.includes(target.replace(/^\.\//, ''))) throw new Error(`${manifest.name}: bin ${target} is not packed`);
        checked++;
    }
    // @cratis/arc.testing exports given() as public API; unlike other given files it must be packed.
    const publicGiven = manifest.name === '@cratis/arc.testing' &&
        readFileSync(join(folder, 'dist', 'index.js'), 'utf8').includes("from './given.js'");
    if (manifest.name === '@cratis/arc.testing' && !publicGiven) throw new Error('Public testing given() export is missing');
    for (const [index, name] of names.entries()) {
        const allowedGiven = publicGiven && ['dist/given.js', 'dist/given.d.ts'].includes(name);
        if (forbidden.test(name) && !allowedGiven) throw new Error(`${manifest.name}: test-only file in tarball: ${name}`);
        if (!['README.md', 'LICENSE', 'package.json'].includes(name) && !name.startsWith('dist/')) {
            throw new Error(`${manifest.name}: unexpected file in tarball: ${name}`);
        }
        if (name.endsWith('.map')) {
            const map = JSON.parse(readFileSync(files[index], 'utf8'));
            for (const source of map.sources ?? []) {
                const location = resolve(dirname(files[index]), map.sourceRoot ?? '', source);
                if (relative(folder, location).startsWith('..') || !existsSync(location)) {
                    throw new Error(`${manifest.name}: source map points outside tarball: ${name} -> ${source}`);
                }
            }
        }
        if (!name.endsWith('.js') && !name.endsWith('.d.ts')) continue;
        const text = readFileSync(files[index], 'utf8');
        for (const specifier of importsFrom(text, name)) {
            if (specifier.startsWith('node:')) continue;
            if (specifier.startsWith('.')) {
                const target = resolve(dirname(files[index]), specifier);
                const expected = name.endsWith('.d.ts') ? target.replace(/\.js$/, '.d.ts') : target;
                if (!/\.(js|json)$/.test(specifier) || !existsSync(expected) || !expected.startsWith(folder + sep)) {
                    throw new Error(`${manifest.name}: broken packed import ${name}: ${specifier}`);
                }
            } else if (!Object.hasOwn(manifest.dependencies ?? {}, dependencyName(specifier)) &&
                !Object.hasOwn(manifest.peerDependencies ?? {}, dependencyName(specifier))) {
                throw new Error(`${manifest.name}: undeclared import ${name}: ${specifier}`);
            }
            checked++;
        }
    }
    if (checked < Object.keys(manifest.exports).length * 2) throw new Error(`${manifest.name}: no packed imports/exports checked`);
    console.log(`${manifest.name}: checked ${names.length} packed files and ${checked} imports/exports`);
}

const temporary = mkdtempSync(join(tmpdir(), 'arc-consumers-'));
try {
    if (!relative(root, temporary).startsWith('..')) throw new Error('Consumer must be outside the workspace');
    const archive = join(temporary, 'archives');
    const consumer = join(temporary, 'consumer');
    mkdirSync(archive);
    mkdirSync(consumer);
    const tarballs = [];
    for (const { folder, manifest } of packages) {
        const path = join(archive, `${manifest.name.replace('/', '-')}.tgz`);
        run('yarn', ['pack', '--out', path], folder);
        const unpacked = join(temporary, 'unpacked', manifest.name.replace('/', '-'));
        mkdirSync(unpacked, { recursive: true });
        run('tar', ['-xzf', path, '-C', unpacked], root);
        const contents = join(unpacked, 'package');
        inspectPackage(contents, manifest);
        if (process.argv.includes('--self-test') && tarballs.length === 0) {
            const planted = join(contents, 'dist', 'injected.spec.js');
            writeFileSync(planted, 'export {};\n');
            let detected = false;
            try { inspectPackage(contents, manifest); } catch (error) {
                if (!String(error).includes('test-only file')) throw error;
                detected = true;
            }
            if (!detected) throw new Error('Checker missed planted test-only file');
            rmSync(planted);
            console.log('Self-test detected planted test-only file');
        }
        tarballs.push(path);
    }
    if (process.argv.includes('--self-test')) {
        console.log(`Self-test passed; inspected ${packages.length} tarballs`);
    } else {
    writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    const peers = new Set(['@types/node', 'typescript', 'rxjs', '@cratis/fundamentals', '@cratis/chronicle',
        'express', 'fastify', 'hono', '@hono/node-server', 'mongodb', 'drizzle-orm', '@opentelemetry/api',
        'zod', 'eslint', '@typescript-eslint/parser', '@types/express', '@types/ws']);
    for (const { manifest } of packages) for (const name of Object.keys(manifest.peerDependencies ?? {})) {
        if (!packages.some(entry => entry.manifest.name === name)) peers.add(name);
    }
    const pinned = [...peers].map(name => `${name}@${lockedVersion(name)}`);
    // npm copies tarballs into a new node_modules tree; there are no workspace links or hoisted workspace packages.
    run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', ...tarballs, ...pinned], consumer);
    for (const { manifest } of packages) {
        const installed = join(consumer, 'node_modules', manifest.name);
        if (!realpathSync(installed).startsWith(realpathSync(consumer) + sep)) throw new Error(`${manifest.name}: workspace link in consumer`);
        if (JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')).version !== manifest.version) {
            throw new Error(`${manifest.name}: installed the wrong version`);
        }
    }
    const imports = packages.flatMap(({ manifest }) => Object.keys(manifest.exports).map(entry =>
        entry === '.' ? manifest.name : `${manifest.name}/${entry.slice(2)}`));
    const smoke = `
import { ArcApplication, command, readModel, query, runArc } from '@cratis/arc.core';
import { field } from '@cratis/fundamentals';
@command()
class Echo { @field(String) message!: string; handle(): string { return this.message; } }
@readModel()
class Greeting { @query() static all(): { message: string } { return { message: 'hello' }; } }
const builder = ArcApplication.createBuilder({ development: true });
builder.add(Echo, Greeting);
const app = await builder.build();
const listener = await runArc(app.server, { port: 0 });
try {
    const address = listener.server.address();
    if (!address || typeof address === 'string') throw new Error('No HTTP listener');
    const url = 'http://127.0.0.1:' + address.port;
    const response = await fetch(url + '/api/echo', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'packed' }) });
    const commandResult = await response.json() as { response: string };
    if (!response.ok || commandResult.response !== 'packed') throw new Error('Packed command HTTP failed: ' + JSON.stringify(commandResult));
    const queryResponse = await fetch(url + '/api/all');
    const queryResult = await queryResponse.json() as { data: { message: string } };
    if (!queryResponse.ok || queryResult.data?.message !== 'hello') throw new Error('Packed query HTTP failed: ' + JSON.stringify(queryResult));
    const fetchResponse = await app.fetch(new Request(url + '/api/all'));
    const fetchResult = await fetchResponse.json() as { data: { message: string } };
    if (!fetchResponse.ok || fetchResult.data?.message !== 'hello') throw new Error('Packed Fetch query failed: ' + JSON.stringify(fetchResult));
    console.log('Native ESM command, query and Fetch HTTP passed');
} finally { await listener.close(); await app.dispose(); }
`;
    const strictImports = `
import type { Server as HttpServer } from 'node:http';
import type { ArcApplicationBuilder } from '@cratis/arc.core';
import { attachNodeWebSockets } from '@cratis/arc.core/hosting';
import express from 'express';
import fastify from 'fastify';
import { Hono } from 'hono';
import { cratisArc as expressArc } from '@cratis/arc.express';
import fastifyArc from '@cratis/arc.fastify';
import { cratisArc as honoArc } from '@cratis/arc.hono';
import { withMongoDB, type MongoDBOptions } from '@cratis/arc.mongodb';
import { CommandScenario, QueryScenario } from '@cratis/arc.testing';
import { analyzeSource } from '@cratis/arc.proxygenerator';
import plugin from '@cratis/eslint-plugin-arc-core';
void [attachNodeWebSockets, CommandScenario, QueryScenario, analyzeSource, plugin];
function configureMongo(builder: ArcApplicationBuilder, options: MongoDBOptions) { withMongoDB(builder, options); }
void configureMongo;
const adapterApp = await ArcApplication.createBuilder().build();
function attachSockets(host: HttpServer) {
    return [expressArc(adapterApp).injectWebSocket(host), honoArc(adapterApp).injectWebSocket(host)];
}
void attachSockets;
try {
    express().use(expressArc(adapterApp));
    const fastifyHost = fastify();
    await fastifyHost.register(fastifyArc, { arc: adapterApp });
    await fastifyHost.close();
    new Hono().use(honoArc(adapterApp));
} finally { await adapterApp.dispose(); }
`;
    const looseSource = `
import { ArcApplication, type ArcApplicationBuilder } from '@cratis/arc.core';
import { withDrizzle, type DrizzleOptions } from '@cratis/arc.drizzle';
import { withChronicle, type ChronicleRegistration } from '@cratis/arc.chronicle';
import { ChronicleCommandScenario } from '@cratis/arc.chronicle/testing';
import { CratisApplication } from '@cratis/cratis';
import { CommandScenario as CratisCommandScenario, ChronicleCommandScenario as CratisChronicleCommandScenario } from '@cratis/cratis/testing';
function configureIntegrations(builder: ArcApplicationBuilder, sql: DrizzleOptions, events: ChronicleRegistration) {
    withDrizzle(builder, sql);
    withChronicle(builder, events);
}
function configureCratis(events: ChronicleRegistration) {
    const composed = CratisApplication.createBuilder({ configuration: false }, events);
    const builder = ArcApplication.createBuilder({ configuration: false });
    builder.addCratis(events);
    return [composed, builder];
}
void [configureIntegrations, configureCratis, ChronicleCommandScenario, CratisCommandScenario, CratisChronicleCommandScenario];
`;
    const compiler = JSON.parse(readFileSync(join(consumer, 'node_modules', 'typescript', 'package.json'), 'utf8'));
    const compilerBin = Object.values(compiler.bin)[0];
    for (const [mode, filename, module] of [['NodeNext', 'consumer.mts', 'NodeNext'], ['Bundler', 'consumer.ts', 'ESNext']]) {
        const directory = join(consumer, mode);
        mkdirSync(directory);
        writeFileSync(join(directory, filename), strictImports + smoke);
        writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
            module, moduleResolution: mode === 'NodeNext' ? 'NodeNext' : 'Bundler', target: 'ES2022', strict: true,
            skipLibCheck: false, types: ['node'], outDir: 'out', noEmit: mode === 'Bundler'
        }, files: [filename] }));
        run(process.execPath, [join(consumer, 'node_modules', 'typescript', compilerBin), '-p', directory], consumer);
        console.log(`${mode} installed-package consumer type-check passed`);
    }
    const looseDirectory = join(consumer, 'integrations');
    mkdirSync(looseDirectory);
    writeFileSync(join(looseDirectory, 'integrations.mts'), looseSource);
    const looseConfig = { compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022',
        strict: true, skipLibCheck: false, noEmit: true, types: ['node'] }, files: ['integrations.mts'] };
    writeFileSync(join(looseDirectory, 'tsconfig.json'), JSON.stringify(looseConfig));
    const compilerCommand = join(consumer, 'node_modules', 'typescript', compilerBin);
    const strictIntegrations = spawnSync(process.execPath, [compilerCommand, '-p', looseDirectory, '--pretty', 'false'],
        { cwd: consumer, encoding: 'utf8' });
    if (strictIntegrations.error) throw strictIntegrations.error;
    const diagnostics = `${strictIntegrations.stdout}${strictIntegrations.stderr}`.split('\n').filter(line => /error TS\d+:/.test(line));
    const external = diagnostics.filter(line => /^node_modules\/(?:@cratis\/chronicle(?:\.contracts)?|drizzle-orm)\//.test(line));
    const unexpected = diagnostics.filter(line => !external.includes(line));
    if (strictIntegrations.status !== 2 || unexpected.length ||
        !external.some(line => line.includes('@cratis/chronicle.contracts/') && line.includes('TS2834')) ||
        !external.some(line => line.includes('drizzle-orm/') && line.includes('TS2420'))) {
        throw new Error(`Unrecognized installed declaration diagnostics (status ${strictIntegrations.status}):\n${strictIntegrations.stdout}${strictIntegrations.stderr}`);
    }
    // Only the two integration graphs have external declaration failures; their consumer source is still checked.
    console.log(`Upstream declaration errors (${external.length}); no Arc declaration or consumer errors:`);
    console.log(strictIntegrations.stdout.trimEnd());
    if (strictIntegrations.stderr) console.error(strictIntegrations.stderr.trimEnd());
    looseConfig.compilerOptions.skipLibCheck = true;
    writeFileSync(join(looseDirectory, 'tsconfig.json'), JSON.stringify(looseConfig));
    run(process.execPath, [compilerCommand, '-p', looseDirectory], consumer);
    console.log('NodeNext Chronicle and Drizzle consumer type-check passed with skipLibCheck: true');
    const looseBundler = join(consumer, 'integrations-bundler');
    mkdirSync(looseBundler);
    writeFileSync(join(looseBundler, 'integrations.ts'), looseSource);
    writeFileSync(join(looseBundler, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
        module: 'ESNext', moduleResolution: 'Bundler', target: 'ES2022', strict: true,
        skipLibCheck: true, noEmit: true, types: ['node']
    }, files: ['integrations.ts'] }));
    run(process.execPath, [compilerCommand, '-p', looseBundler], consumer);
    console.log('Bundler Chronicle and Drizzle consumer type-check passed with skipLibCheck: true');
    run(process.execPath, [join(consumer, 'NodeNext', 'out', 'consumer.mjs')], consumer);
    run(process.execPath, [join(consumer, 'node_modules', '@cratis', 'arc.proxygenerator', 'dist', 'cli.js'), '--help'], consumer);
    run(process.execPath, ['--input-type=module', '-e', `
        for (const entry of ${JSON.stringify(imports)}) await import(entry);
        console.log('Native ESM imports passed: ${imports.length} entries');
    `], consumer);
    const noRx = join(temporary, 'without-rxjs');
    mkdirSync(noRx);
    writeFileSync(join(noRx, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    const core = packages.find(entry => entry.manifest.name === '@cratis/arc.core');
    if (!core) throw new Error('Missing core package');
    run('npm', ['install', '--ignore-scripts', '--omit=optional', '--no-audit', '--no-fund', '--no-package-lock',
        tarballs[packages.indexOf(core)], ...['@cratis/fundamentals', '@opentelemetry/api', '@types/node', 'typescript']
            .map(name => `${name}@${lockedVersion(name)}`)], noRx);
    if (existsSync(join(noRx, 'node_modules', 'rxjs'))) throw new Error('No-rxjs consumer unexpectedly installed rxjs');
    writeFileSync(join(noRx, 'consumer.mts'), smoke);
    writeFileSync(join(noRx, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
        module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', strict: true,
        skipLibCheck: false, types: ['node'], outDir: 'out'
    }, files: ['consumer.mts'] }));
    const noRxCompiler = JSON.parse(readFileSync(join(noRx, 'node_modules', 'typescript', 'package.json'), 'utf8'));
    run(process.execPath, [join(noRx, 'node_modules', 'typescript', Object.values(noRxCompiler.bin)[0]), '-p', noRx], noRx);
    run(process.execPath, [join(noRx, 'out', 'consumer.mjs')], noRx);
    console.log('Core installed without optional rxjs: strict NodeNext and native HTTP passed');
    }
} finally { rmSync(temporary, { recursive: true, force: true }); }
