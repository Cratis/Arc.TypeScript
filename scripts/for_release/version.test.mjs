// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { prepareVersion, writeVersion } from './version.mjs';

const script = fileURLToPath(new URL('../set-version.mjs', import.meta.url));
const root = join(dirname(script), '..');

function fixture(t) {
    const folder = mkdtempSync(join(tmpdir(), 'arc-set-version-'));
    t.after(() => rmSync(folder, { recursive: true, force: true }));
    const files = {
        'package.json': { workspaces: ['Source/*', 'Source/Tools/*', 'Samples/*', 'ContractTests/Client', 'ContractTests/Http'] },
        'Source/CodeAnalysis/package.json': { name: '@cratis/eslint-plugin-arc-core', version: '0.19.0' },
        'Source/Core/package.json': { name: '@cratis/arc.core', version: '0.19.0', dependencies: { '@cratis/arc.testing': 'workspace:^', '@cratis/cratis': '^0.19.0' } },
        'Source/Tools/Generator/package.json': { name: '@cratis/arc.proxygenerator', version: '0.19.0', dependencies: { '@cratis/arc.core': 'workspace:*' } },
        'Source/Testing/package.json': { name: '@cratis/arc.testing', version: '0.19.0', peerDependencies: { '@cratis/arc.core': '^0.18.0' } },
        'Source/Cratis/package.json': { name: '@cratis/cratis', version: '0.19.0', optionalDependencies: { '@cratis/arc.core': '^0.19.0' }, devDependencies: { '@cratis/arc.testing': '^0.18.0' } },
        'Samples/Tasks/package.json': { name: 'sample', dependencies: { '@cratis/cratis': 'workspace:^' } },
        'ContractTests/Client/package.json': { name: 'contract', version: '0.19.0', dependencies: { '@cratis/arc.react': '22.19.1' } },
        'ContractTests/Http/package.json': { name: 'http', devDependencies: { '@cratis/arc.core': 'workspace:*' } }
    };
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(dirname(join(folder, file)), { recursive: true });
        writeFileSync(join(folder, file), JSON.stringify(content, null, 2) + '\n');
    }
    for (const file of ['README.md', 'Documentation/index.md', 'Documentation/reference/packages.md']) {
        mkdirSync(dirname(join(folder, file)), { recursive: true });
        const original = readFileSync(join(root, file), 'utf8');
        const line = original.split('\n').find(text => /(?:Every package manifest is at version|the manifests are at version|Every package in this repository is at version)/.test(text));
        writeFileSync(join(folder, file), `${line.replace(/version \d+\.\d+\.\d+/, 'version 0.19.0')}\n`);
    }
    for (const file of ['Source/Core/Version.ts', 'Source/CodeAnalysis/Version.ts']) {
        writeFileSync(join(folder, file), readFileSync(join(root, file), 'utf8').replace(/'\d+\.\d+\.\d+'/g, "'0.19.0'"));
    }
    return folder;
}

function manifest(root, path) {
    return JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8'));
}

test('updates versioned workspaces, all internal non-workspace ranges, and three statements without touching external clients or workspace ranges', t => {
    const folder = fixture(t);
    const plan = prepareVersion(folder, '0.20.0');
    assert.equal(plan.packages, 6);
    assert.equal(plan.unversioned, 2);
    assert.equal(plan.ranges, 4);
    assert.equal(plan.statements, 3);
    assert.equal(plan.constants, 2);
    writeVersion(folder, plan);
    assert.equal(manifest(folder, 'Source/Core').dependencies['@cratis/cratis'], '^0.20.0');
    assert.equal(manifest(folder, 'Source/Cratis').devDependencies['@cratis/arc.testing'], '^0.20.0');
    assert.equal(manifest(folder, 'Source/Testing').peerDependencies['@cratis/arc.core'], '^0.20.0');
    assert.equal(manifest(folder, 'Source/Cratis').optionalDependencies['@cratis/arc.core'], '^0.20.0');
    assert.equal(manifest(folder, 'Source/Core').dependencies['@cratis/arc.testing'], 'workspace:^');
    assert.equal(manifest(folder, 'ContractTests/Client').dependencies['@cratis/arc.react'], '22.19.1');
    assert.equal(manifest(folder, 'Samples/Tasks').version, undefined);
    assert.equal(prepareVersion(folder, undefined, { check: true }).version, '0.20.0');
    for (const file of ['README.md', 'Documentation/index.md', 'Documentation/reference/packages.md']) {
        assert.match(readFileSync(join(folder, file), 'utf8'), /version 0\.20\.0/);
    }
    for (const file of ['Source/Core/Version.ts', 'Source/CodeAnalysis/Version.ts']) {
        assert.match(readFileSync(join(folder, file), 'utf8'), /export const packageVersion = '0\.20\.0';/);
    }
});

for (const file of ['Source/Core/Version.ts', 'Source/CodeAnalysis/Version.ts']) {
    test(`checks stale, missing, and malformed ${file} without writing and regenerates it in the version plan`, t => {
        const folder = fixture(t);
        writeVersion(folder, prepareVersion(folder, '0.19.0'));
        const path = join(folder, file);
        const original = readFileSync(path, 'utf8');
        for (const planted of [original.replace('0.19.0', '0.18.0'), 'export const packageVersion = process.env.VERSION;\n', undefined]) {
            if (planted === undefined) rmSync(path);
            else writeFileSync(path, planted);
            assert.throws(() => prepareVersion(folder, undefined, { check: true }), error =>
                error.message.includes(`${file}: generated version constant is missing or stale`));
            const plan = prepareVersion(folder, '0.20.0');
            if (planted === undefined) assert.throws(() => readFileSync(path), { code: 'ENOENT' });
            else assert.equal(readFileSync(path, 'utf8'), planted);
            assert.equal(manifest(folder, 'Source/Core').version, '0.19.0');
            const edit = plan.edits.find(edit => edit.file === file);
            assert.ok(edit);
            assert.match(edit.content, /export const packageVersion = '0\.20\.0';/);
        }
        writeVersion(folder, prepareVersion(folder, '0.20.0'));
        assert.equal(prepareVersion(folder, undefined, { check: true }).version, '0.20.0');
    });
}

test('check mode detects planted manifest, internal range, and statement drift without writing', t => {
    const folder = fixture(t);
    const file = join(folder, 'Source/Core/package.json');
    const source = readFileSync(file, 'utf8').replace('"0.19.0"', '"0.18.0"');
    writeFileSync(file, source);
    const document = join(folder, 'README.md');
    const text = readFileSync(document, 'utf8').replace('version 0.19.0', 'version 0.18.0');
    writeFileSync(document, text);
    assert.throws(() => prepareVersion(folder, '0.19.0', { check: true }), error =>
        /Source\/Core\/package.json: version 0.18.0/.test(error.message) &&
        /Source\/Testing\/package.json: peerDependencies.@cratis\/arc.core is \^0.18.0/.test(error.message) &&
        /README.md: statement has 0.18.0/.test(error.message));
    assert.throws(() => prepareVersion(folder, undefined, { check: true }), /Source\/Core\/package.json: version 0.18.0/);
    assert.equal(readFileSync(file, 'utf8'), source);
    assert.equal(readFileSync(document, 'utf8'), text);
});

test('refuses a missing or duplicated expected statement before writing', t => {
    const folder = fixture(t);
    const file = join(folder, 'Documentation/index.md');
    const original = readFileSync(file, 'utf8');
    writeFileSync(file, 'No source preview version here\n');
    assert.throws(() => prepareVersion(folder, '0.20.0'), /exactly one version statement in Documentation\/index.md, found 0/);
    assert.equal(manifest(folder, 'Source/Core').version, '0.19.0');
    writeFileSync(file, original + original);
    assert.throws(() => prepareVersion(folder, '0.20.0'), /found 2/);
});

test('refuses an empty internal-range population', t => {
    const folder = fixture(t);
    for (const path of ['Source/Core', 'Source/Cratis', 'Source/Testing']) {
        const file = join(folder, path, 'package.json');
        const value = manifest(folder, path);
        for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
            for (const [name, range] of Object.entries(value[section] ?? {})) {
                if (!range.startsWith('workspace:')) delete value[section][name];
            }
        }
        writeFileSync(file, JSON.stringify(value));
    }
    assert.throws(() => prepareVersion(folder, undefined, { check: true }), /No non-workspace internal dependency ranges/);
});

test('refuses a missing version in a versioned workspace', t => {
    const folder = fixture(t);
    const file = join(folder, 'ContractTests/Client/package.json');
    writeFileSync(file, JSON.stringify({ name: 'contract' }));
    assert.throws(() => prepareVersion(folder, undefined, { check: true }), /Missing version in ContractTests\/Client\/package.json/);
});

test('refuses a major version change without explicit flag', t => {
    const folder = fixture(t);
    assert.throws(() => prepareVersion(folder, '1.0.0'), /requires --allow-major/);
    assert.equal(prepareVersion(folder, '1.0.0', { allowMajor: true }).version, '1.0.0');
});

for (const version of ['v0.20.0', '0.20', '0.20.0-beta.1', '01.2.3', '1.2.3+meta', '99999999999999999999.0.0']) {
    test(`refuses invalid stable version ${version}`, t => {
        assert.throws(() => prepareVersion(fixture(t), version), /Invalid stable version/);
    });
}

test('CLI check succeeds on the repository; invalid usage fails without an install', () => {
    const current = JSON.parse(readFileSync(join(root, 'Source/Core/package.json'), 'utf8')).version;
    const checked = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr);
    assert.ok(checked.stdout.includes(`Checked version ${current}: `), checked.stdout);
    const invalid = spawnSync(process.execPath, [script, '0.20.0-beta.1'], { encoding: 'utf8' });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Invalid stable version/);
});
