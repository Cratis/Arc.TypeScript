// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Guards the @cratis/chronicle peer floor of @cratis/arc.chronicle. The published dist is ESM, so importing a named
// export the installed SDK lacks fails when the module links, even when the feature using it is off. Every named
// runtime import from @cratis/chronicle in the shipped dist must therefore exist in the lowest SDK the peer range allows.
//
// The floor's exports are recorded in chronicle-peer-floor-exports.json. After raising the peer floor, regenerate it
// from an install of that exact version whose dependencies resolve (for example inside .ai-work/):
//   node scripts/check-chronicle-peer-floor.mjs --update <folder>/node_modules/@cratis/chronicle

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'scripts', 'chronicle-peer-floor-exports.json');
const packageFolder = join(root, 'Source', 'Chronicle');
const sdk = '@cratis/chronicle';

function peerFloor() {
    const range = JSON.parse(readFileSync(join(packageFolder, 'package.json'), 'utf8')).peerDependencies?.[sdk];
    const floor = /^\^(\d+\.\d+\.\d+)$/.exec(range ?? '')?.[1];
    if (!floor) throw new Error(`Expected a caret peer range for ${sdk}, found ${range}`);
    return floor;
}

/** Runtime imports from the SDK that could fail to link against the recorded floor exports. */
export function violations(source, exportsBySpecifier, file = '<source>') {
    const found = [];
    const pattern = /^\s*(import|export)\s+(?!type\b)([^;'"]*?)\s*from\s*['"](@cratis\/chronicle(?:\/[^'"]*)?)['"]/gm;
    for (const match of source.matchAll(pattern)) {
        const [, , clause, specifier] = match;
        const available = exportsBySpecifier[specifier];
        if (!available) { found.push(`${file}: ${specifier} is not an entry point of the peer floor`); continue; }
        const named = /\{([^}]*)\}/.exec(clause);
        const rest = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
        if (rest && !/^\*(\s+as\s+\w+)?$/.test(rest)) found.push(`${file}: ${specifier} default import '${rest}' is not supported`);
        for (const part of named ? named[1].split(',') : []) {
            const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim();
            if (!name || part.trim().startsWith('type ')) continue;
            if (!available.includes(name)) found.push(`${file}: ${specifier} does not export '${name}' in the peer floor`);
        }
    }
    for (const match of source.matchAll(/^\s*import\s*['"](@cratis\/chronicle(?:\/[^'"]*)?)['"]/gm)) {
        if (!exportsBySpecifier[match[1]]) found.push(`${file}: ${match[1]} is not an entry point of the peer floor`);
    }
    return found;
}

function shippedFiles(folder) {
    const files = [];
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        const relativePath = relative(join(packageFolder, 'dist'), path).split(sep).join('/');
        // Mirrors the "files" exclusions in Source/Chronicle/package.json.
        if (relativePath === 'Integration' || relativePath.startsWith('given.')) continue;
        if (entry.isDirectory()) files.push(...shippedFiles(path));
        else if (entry.name.endsWith('.js')) files.push(path);
    }
    return files;
}

async function update(installed) {
    const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
    if (manifest.name !== sdk) throw new Error(`${installed} is not ${sdk}`);
    if (manifest.version !== peerFloor()) throw new Error(`${installed} is ${manifest.version}, not the peer floor ${peerFloor()}`);
    const exportsBySpecifier = {};
    for (const [subpath, target] of Object.entries(manifest.exports)) {
        const entry = typeof target === 'string' ? target : target.import ?? target.default;
        if (!entry?.endsWith('.js')) continue;
        exportsBySpecifier[sdk + subpath.slice(1)] = Object.keys(await import(pathToFileURL(join(installed, entry)).href)).sort();
    }
    writeFileSync(baselinePath, `${JSON.stringify({ version: manifest.version, exports: exportsBySpecifier }, null, 2)}\n`);
    console.log(`Recorded ${sdk} ${manifest.version} exports`);
}

function selfTest() {
    const floor = { [sdk]: ['ChronicleClient'], [`${sdk}/artifacts`]: ['DefaultClientArtifactsProvider'] };
    const expectations = [
        ["import { ArtifactDelivery } from '@cratis/chronicle/artifacts';", 1],
        ["import { ChronicleClient as Client } from '@cratis/chronicle';", 0],
        ["import type { ArtifactDelivery } from '@cratis/chronicle/artifacts';", 0],
        ["import { type ArtifactDelivery, DefaultClientArtifactsProvider } from '@cratis/chronicle/artifacts';", 0],
        ["import * as artifacts from '@cratis/chronicle/artifacts';", 0],
        ["export { ArtifactDelivery } from '@cratis/chronicle/artifacts';", 1],
        ["import Chronicle from '@cratis/chronicle';", 1],
        ["import '@cratis/chronicle/activation';", 1],
        ["import { ChronicleClient } from '@cratis/chronicle/newEntry';", 1]
    ];
    for (const [source, expected] of expectations) {
        const actual = violations(source, floor).length;
        if (actual !== expected) throw new Error(`Self-test: expected ${expected} violation(s) for ${source}, found ${actual}`);
    }
    console.log('Chronicle peer floor check self-test passed');
}

async function check() {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    const floor = peerFloor();
    if (baseline.version !== floor)
        throw new Error(`Recorded exports are for ${sdk} ${baseline.version}, but the peer floor is ${floor}; regenerate them with --update`);
    const dist = join(packageFolder, 'dist');
    if (!existsSync(dist)) throw new Error('Source/Chronicle/dist is missing; run yarn build first');
    const files = shippedFiles(dist);
    const found = files.flatMap(file => violations(readFileSync(file, 'utf8'), baseline.exports, relative(root, file)));
    if (found.length) throw new Error(`@cratis/arc.chronicle imports ${sdk} exports newer than its peer floor ${floor}:\n${found.join('\n')}`);
    console.log(`@cratis/arc.chronicle loads with ${sdk} ${floor}: ${files.length} shipped modules checked`);
}

const [mode, argument] = process.argv.slice(2);
if (mode === '--self-test') selfTest();
else if (mode === '--update') await update(resolve(argument ?? ''));
else await check();
