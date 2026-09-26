// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const packages = workspace.workspaces.filter(pattern => pattern.endsWith('/*')).flatMap(pattern => {
    const base = join(root, pattern.slice(0, -1));
    return readdirSync(base, { withFileTypes: true }).filter(entry => entry.isDirectory())
        .map(entry => join(base, entry.name)).filter(folder => existsSync(join(folder, 'package.json')));
}).map(folder => ({ folder, manifest: JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8')) }))
    .filter(({ manifest }) => manifest.private !== true);
if (packages.length !== 11) throw new Error(`Expected 11 publishable packages, found ${packages.length}`);

const entries = packages.flatMap(({ folder, manifest }) => Object.entries(manifest.exports).map(([subpath, targets]) => {
    const declaration = resolve(folder, targets.types);
    if (!declaration.startsWith(join(folder, 'dist') + sep) || !existsSync(declaration)) {
        throw new Error(`${manifest.name}/${subpath}: missing built declaration ${targets.types}`);
    }
    return { name: subpath === '.' ? manifest.name : `${manifest.name}/${subpath.slice(2)}`, declaration };
}));
// Compile the actual exported dist declarations, not source (which still sees @internal members).
// This virtual consumer also checks that each package root and subpath resolves by its published name.
const consumer = join(root, 'scripts', '.check-declarations-consumer.mts');
const source = entries.map(({ name }, index) => `import * as entry${index} from '${name}';\nvoid entry${index};`).join('\n');
const options = {
    module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022, strict: true, skipLibCheck: false, noEmit: true, types: ['node']
};
const host = ts.createCompilerHost(options);
const readFile = host.readFile.bind(host);
const fileExists = host.fileExists.bind(host);
host.readFile = filename => filename === consumer ? source : readFile(filename);
host.fileExists = filename => filename === consumer || fileExists(filename);
const program = ts.createProgram([consumer, ...entries.map(entry => entry.declaration)], options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
// These installed upstream declarations currently fail strict checking even without Arc. Never
// suppress diagnostics in this repository's dist or the consumer; report the known external debt.
const upstream = diagnostics.filter(diagnostic => {
    const file = diagnostic.file?.fileName;
    if (!file) return false;
    const path = relative(join(root, 'node_modules'), file).split(sep).join('/');
    return path.startsWith('@cratis/chronicle.contracts/') && diagnostic.code === 2834 ||
        path.startsWith('@cratis/chronicle/') && [2305, 2694].includes(diagnostic.code) ||
        path.startsWith('drizzle-orm/') && [2307, 2416, 2420, 2344, 2515, 2559].includes(diagnostic.code);
});
const failures = diagnostics.filter(diagnostic => !upstream.includes(diagnostic));
if (failures.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(failures, {
        getCurrentDirectory: () => root, getCanonicalFileName: filename => filename, getNewLine: () => '\n'
    }));
    process.exitCode = 1;
} else {
    console.log(`Strict built-declaration type-check passed: ${packages.length} packages, ${entries.length} entry points (${upstream.length} known upstream diagnostics excluded)`);
}
