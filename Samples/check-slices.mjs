// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
// Proves the samples keep the vertical-slice layout: Features/<Feature>/<Slice>/ holds a slice's backend, its generated
// proxy, its UI and its for_*/when_* specifications together. A model shared by several slices of one feature keeps its
// proxy beside its source at the feature level; nothing else is allowed there. Usage: node Samples/check-slices.mjs [Tasks Library Showcase]
import { readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { fileURLToPath } from 'node:url';

const samples = dirname(fileURLToPath(import.meta.url));
const requested = process.argv.slice(2);
const names = requested.length > 0 ? requested : ['Tasks', 'Library', 'Showcase'];
const layerNames = new Set(['controllers', 'services', 'models', 'views', 'components', 'hooks', 'utils', 'helpers', 'repositories', 'handlers', 'pages', 'types']);
const problems = [];
const checked = [];

function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? [{ path, directory: true }, ...walk(path)] : [{ path, directory: false }];
    });
}

for (const name of names) {
    const features = join(samples, name, 'Features');
    if (!existsSync(features)) { problems.push(`${name}: no Features folder`); continue; }
    const entries = walk(features);
    // depth 1 = feature, depth 2 = slice, anything deeper belongs to the slice (specs, given folders).
    const depth = path => relative(features, path).split(sep).length;
    const slices = entries.filter(entry => entry.directory && depth(entry.path) === 2 && !relative(features, entry.path).split(sep)[1].startsWith('for_') && relative(features, entry.path).split(sep)[1] !== 'given');
    if (slices.length === 0) problems.push(`${name}: no Features/<Feature>/<Slice> folders`);
    for (const entry of entries) {
        const where = `${name}/Features/${relative(features, entry.path).split(sep).join('/')}`;
        const segments = relative(features, entry.path).split(sep);
        const base = segments.at(-1);
        if (entry.directory && layerNames.has(base.toLowerCase())) problems.push(`${where}: technical-layer folder`);
        if (!entry.directory && base.endsWith('.proxy.ts') && (segments.length < 2 || segments.length > 3)) problems.push(`${where}: a generated proxy must sit beside its source, inside its feature`);
        if (entry.directory && base.startsWith('for_') && segments.length !== 3) problems.push(`${where}: specifications must sit directly inside their slice`);
        if (!entry.directory && /\.tsx$/.test(base) && segments.length < 2) problems.push(`${where}: UI at the root of Features`);
    }
    for (const slice of slices) {
        const children = readdirSync(slice.path);
        if (!children.some(child => child.startsWith('for_'))) problems.push(`${name}/Features/${relative(features, slice.path).split(sep).join('/')}: slice has no for_* specifications`);
        if (!children.some(child => /\.tsx?$/.test(child) && !child.endsWith('.proxy.ts'))) problems.push(`${name}/Features/${relative(features, slice.path).split(sep).join('/')}: slice has no backend file`);
    }
    checked.push(`${name}: ${slices.length} slices`);
}

if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
}
console.log(`Vertical slices OK (${checked.join(', ')})`);
