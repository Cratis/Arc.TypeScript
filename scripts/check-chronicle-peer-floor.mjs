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

const specifierPattern = String.raw`(['"])(@cratis\/chronicle(?:\/[^'"]*)?)`;
const bindings = String.raw`(?:type\b\s*)?(?:[\w$]+\s*,\s*)?(?:\{[^}]*\}|\*\s*(?:as\s+[\w$]+)?|[\w$]+)`;
// Emit styles vary (tsc, bundlers, minifiers), so whitespace between tokens is optional throughout.
const staticPattern = new RegExp(String.raw`(?<![\w$.])(import|export)\s*(${bindings})\s*from\s*${specifierPattern}\3`, 'g');
const sideEffectPattern = new RegExp(String.raw`(?<![\w$.])import\s*${specifierPattern}\1`, 'g');
const dynamicPattern = new RegExp(String.raw`(?<![\w$.])import\s*\(\s*${specifierPattern}\1\s*\)`, 'g');
const referencePattern = new RegExp(specifierPattern + String.raw`\1`, 'g');

/** Every import or re-export of the SDK in the source: static, side-effect and dynamic. */
export function sdkImports(source) {
    return [
        ...[...source.matchAll(staticPattern)].map(match => ({ clause: match[2].trim(), specifier: match[4] })),
        ...[...source.matchAll(sideEffectPattern)].map(match => ({ specifier: match[2] })),
        ...[...source.matchAll(dynamicPattern)].map(match => ({ specifier: match[2], dynamic: true }))
    ];
}

/** Runtime imports from the SDK that could fail to link against the recorded floor exports. */
export function violations(source, exportsBySpecifier, file = '<source>') {
    const found = [];
    const imports = sdkImports(source);
    // A quoted SDK specifier outside any recognized import form (for example require) would otherwise go unchecked.
    const references = [...source.matchAll(referencePattern)].length;
    if (references > imports.length)
        found.push(`${file}: ${references - imports.length} reference(s) to ${sdk} are not in a recognized import form`);
    // A dynamic import is resolved only when it runs, so it cannot stop the module from linking; callers handle its failure.
    for (const { clause, specifier } of imports.filter(entry => !entry.dynamic)) {
        const available = exportsBySpecifier[specifier];
        if (!available) { found.push(`${file}: ${specifier} is not an entry point of the peer floor`); continue; }
        if (clause === undefined || /^type\b/.test(clause)) continue;
        const named = /\{([^}]*)\}/.exec(clause);
        const rest = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
        if (rest && !/^\*(\s*as\s+[\w$]+)?$/.test(rest)) found.push(`${file}: ${specifier} default import '${rest}' is not supported`);
        for (const part of named ? named[1].split(',') : []) {
            const binding = part.trim();
            if (!binding || /^type\s/.test(binding)) continue;
            const name = binding.split(/\s+as\s+/)[0].trim();
            if (!available.includes(name)) found.push(`${file}: ${specifier} does not export '${name}' in the peer floor`);
        }
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
        ["import { ChronicleClient } from '@cratis/chronicle/newEntry';", 1],
        ['import{ArtifactDelivery}from"@cratis/chronicle/artifacts";', 1],
        ['import{ChronicleClient as Client}from"@cratis/chronicle";', 0],
        ['import type{ArtifactDelivery}from"@cratis/chronicle/artifacts";', 0],
        ['import*as artifacts from"@cratis/chronicle/artifacts";', 0],
        ["import {\n    ChronicleClient,\n    ArtifactDelivery\n} from '@cratis/chronicle';", 1],
        ["export * from '@cratis/chronicle';", 0],
        ['export*from"@cratis/chronicle/newEntry";', 1],
        ["export * as chronicle from '@cratis/chronicle';", 0],
        ['export{ArtifactDelivery as Delivery}from"@cratis/chronicle/artifacts";', 1],
        ['import"@cratis/chronicle/activation";', 1],
        ["const artifacts = await import('@cratis/chronicle/artifacts');", 0],
        ['const later=import("@cratis/chronicle/newEntry");', 0],
        ["const chronicle = require('@cratis/chronicle');", 1],
        ["import { ChronicleClient } from '@cratis/chronicle'; const e = new Error('requires @cratis/chronicle 6.17.0');", 0]
    ];
    if (sdkImports('import{ChronicleClient}from"@cratis/chronicle";export*from"@cratis/chronicle/artifacts";').length !== 2)
        throw new Error('Self-test: compact static imports and re-exports were not all recognized');
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
    const sources = files.map(file => [file, readFileSync(file, 'utf8')]);
    const found = sources.flatMap(([file, source]) => violations(source, baseline.exports, relative(root, file)));
    const imports = sources.reduce((count, [, source]) => count + sdkImports(source).length, 0);
    // The shipped integration imports the SDK; finding none means the patterns no longer match the emit.
    if (!imports) throw new Error(`Found no ${sdk} imports in ${files.length} shipped modules; the check would pass without checking anything`);
    if (found.length) throw new Error(`@cratis/arc.chronicle imports ${sdk} exports newer than its peer floor ${floor}:\n${found.join('\n')}`);
    console.log(`@cratis/arc.chronicle loads with ${sdk} ${floor}: ${imports} imports in ${files.length} shipped modules checked`);
}

const [mode, argument] = process.argv.slice(2);
if (mode === '--self-test') selfTest();
else if (mode === '--update') await update(resolve(argument ?? ''));
else await check();
