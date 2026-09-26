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
// Strict checking of the installed dependencies produces this exact external debt. Each
// entry is removed when its count changes (including dropping to zero); never exempt Arc dist.
const upstreamAllowlist = [
    // Chronicle contracts uses an extensionless relative import; remove when its NodeNext exports add the extension.
    { package: '@cratis/chronicle.contracts', code: 2834, count: 1 },
    // Chronicle imports absent contracts exports; remove when the installed Chronicle/contracts versions agree.
    { package: '@cratis/chronicle', code: 2305, count: 41 },
    // Chronicle references absent contracts namespace members; remove when the installed versions agree.
    { package: '@cratis/chronicle', code: 2694, count: 20 },
    // Drizzle's optional gel types are not installed; remove when its declarations stop requiring gel.
    { package: 'drizzle-orm', code: 2307, count: 6 },
    // Drizzle's SingleStore builder override has a conflicting type; remove when Drizzle corrects the override.
    { package: 'drizzle-orm', code: 2416, count: 1 },
    // Drizzle query classes lack the SQLWrapper getSQL member; remove when Drizzle implements it.
    { package: 'drizzle-orm', code: 2420, count: 5 },
    // Drizzle's selected-field strings violate keyof constraints; remove when Drizzle fixes its generics.
    { package: 'drizzle-orm', code: 2344, count: 18 },
    // Drizzle builders/select classes lack inherited abstract members; remove when Drizzle implements them.
    { package: 'drizzle-orm', code: 2515, count: 33 },
    // Drizzle role types do not overlap their config types; remove when Drizzle aligns those types.
    { package: 'drizzle-orm', code: 2559, count: 2 }
];
const arcDeclaration = entries.find(entry => entry.name === '@cratis/arc.core')?.declaration;
if (!arcDeclaration) throw new Error('Expected @cratis/arc.core declaration for self-test');

function compile(plantArcError = false) {
    const host = ts.createCompilerHost(options);
    const readFile = host.readFile.bind(host);
    const fileExists = host.fileExists.bind(host);
    host.readFile = filename => {
        if (filename === consumer) return source;
        const content = readFile(filename);
        if (plantArcError && filename === arcDeclaration && content !== undefined) {
            return `${content}\nexport type __ArcDeclarationSelfTest = __ArcDeclarationSelfTestMissingType;\n`;
        }
        return content;
    };
    host.fileExists = filename => filename === consumer || fileExists(filename);
    const program = ts.createProgram([consumer, ...entries.map(entry => entry.declaration)], options, host);
    return ts.getPreEmitDiagnostics(program);
}

function allowedEntry(diagnostic) {
    const file = diagnostic.file?.fileName;
    if (!file) return undefined;
    const path = relative(join(root, 'node_modules'), file).split(sep).join('/');
    return upstreamAllowlist.find(entry => path.startsWith(`${entry.package}/`) && diagnostic.code === entry.code);
}

function evaluate(diagnostics) {
    const counts = new Map(upstreamAllowlist.map(entry => [entry, 0]));
    const failures = [];
    for (const diagnostic of diagnostics) {
        const entry = allowedEntry(diagnostic);
        if (entry) counts.set(entry, counts.get(entry) + 1);
        else failures.push(diagnostic);
    }
    const mismatches = upstreamAllowlist.filter(entry => counts.get(entry) !== entry.count)
        .map(entry => ({ entry, actual: counts.get(entry) }));
    return { passed: failures.length === 0 && mismatches.length === 0,
        failures, mismatches, excluded: diagnostics.length - failures.length };
}

const diagnostics = compile();
const verdict = evaluate(diagnostics);
const { failures, mismatches, excluded } = verdict;
if (!verdict.passed) {
    if (failures.length) console.error(ts.formatDiagnosticsWithColorAndContext(failures, {
        getCurrentDirectory: () => root, getCanonicalFileName: filename => filename, getNewLine: () => '\n'
    }));
    for (const { entry, actual } of mismatches) {
        console.error(`${entry.package} TS${entry.code}: expected ${entry.count} upstream diagnostics, found ${actual}; update or remove the exemption after investigation`);
    }
    process.exitCode = 1;
} else if (process.argv.includes('--self-test')) {
    const plantedArc = evaluate(compile(true));
    if (plantedArc.passed || !plantedArc.failures.some(d => d.file?.fileName === arcDeclaration &&
        ts.flattenDiagnosticMessageText(d.messageText, '\n').includes('__ArcDeclarationSelfTestMissingType'))) {
        throw new Error('Self-test failed: planted Arc declaration error was not caught');
    }
    const knownUpstream = diagnostics.find(d => allowedEntry(d));
    if (!knownUpstream) throw new Error('Self-test failed: no upstream diagnostic to plant');
    const plantedUpstream = evaluate([...diagnostics, { ...knownUpstream, messageText: 'Planted extra upstream diagnostic' }]);
    const plantedEntry = allowedEntry(knownUpstream);
    if (plantedUpstream.passed || plantedUpstream.failures.length || plantedUpstream.mismatches.length !== 1 ||
        plantedUpstream.mismatches[0].entry !== plantedEntry ||
        plantedUpstream.mismatches[0].actual !== plantedEntry.count + 1) {
        throw new Error('Self-test failed: extra upstream diagnostic did not invalidate its exact count');
    }
    console.log(`Declaration guard self-test passed: planted Arc declaration error and extra ${plantedEntry.package} TS${plantedEntry.code} diagnostic rejected (${packages.length} packages, ${entries.length} entry points)`);
} else {
    console.log(`Strict built-declaration type-check passed: ${packages.length} packages, ${entries.length} entry points (${excluded} known upstream diagnostics excluded)`);
}
