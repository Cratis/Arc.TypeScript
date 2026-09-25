// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { workspaces } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const folders = workspaces.flatMap(pattern => pattern.endsWith('/*')
    ? readdirSync(join(root, pattern.slice(0, -2)), { withFileTypes: true })
        .filter(entry => entry.isDirectory()).map(entry => join(root, pattern.slice(0, -2), entry.name))
    : [join(root, pattern)]).filter(folder => existsSync(join(folder, 'package.json')));
if (!folders.length) throw new Error('No workspaces found; refusing to clean');
const targets = new Set();
function scan(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.ai-work' || entry.name === '.git') continue;
            if (entry.name === 'dist') targets.add(path);
            else scan(path);
        } else if (entry.isFile() && entry.name.endsWith('.tsbuildinfo')) targets.add(path);
    }
}
for (const folder of folders) scan(folder);
for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.tsbuildinfo')) targets.add(join(root, entry.name));
}
const paths = [...targets].sort();
if (paths.length > 256) throw new Error(`Refusing to clean ${paths.length} outputs in one pass (limit: 256)`);
for (const path of paths) {
    const tracked = execFileSync('git', ['ls-files', '--', relative(root, path)], { cwd: root, encoding: 'utf8' });
    if (tracked.trim()) throw new Error(`Refusing to remove tracked files in ${relative(root, path)}: ${tracked.trim()}`);
}
console.log(`Removing ${paths.length} build outputs:`);
for (const path of paths) {
    console.log(relative(root, path));
    rmSync(path, { recursive: true });
}
