// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Packs and publishes every non-private workspace package that is not already on the registry, dependencies
// first. A package is packed with `yarn pack` so `workspace:` ranges are rewritten, then published with npm.
// In GitHub Actions npm authenticates through trusted publishing (OIDC) and adds provenance; locally it uses
// whatever credentials the user's npm configuration provides.
//
// Usage: node scripts/publish-npm.mjs [--dry-run]
//
// A failure stops the run and exits non-zero: a partial publish must never report success. Re-running is safe
// because versions already on the registry are skipped.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');
const inCi = process.env.GITHUB_ACTIONS === 'true';

function workspaces() {
    const found = [];
    const visit = directory => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === 'dist') continue;
            const path = join(directory, entry.name);
            const manifestPath = join(path, 'package.json');
            if (existsSync(manifestPath)) {
                const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
                if (!manifest.private && manifest.name && manifest.version) found.push({ path, manifest });
            }
            if (entry.name === 'Tools') visit(path);
        }
    };
    visit(join(root, 'Source'));
    return found;
}

function inDependencyOrder(packages) {
    const byName = new Map(packages.map(entry => [entry.manifest.name, entry]));
    const ordered = [];
    const state = new Map();
    const visit = entry => {
        const current = state.get(entry.manifest.name);
        if (current === 'done') return;
        if (current === 'visiting') throw new Error(`Dependency cycle at ${entry.manifest.name}`);
        state.set(entry.manifest.name, 'visiting');
        const { dependencies = {}, peerDependencies = {}, optionalDependencies = {} } = entry.manifest;
        // devDependencies are excluded: the packages and their testing support depend on each other in development.
        for (const name of Object.keys({ ...dependencies, ...peerDependencies, ...optionalDependencies })) {
            const dependency = byName.get(name);
            if (dependency) visit(dependency);
        }
        state.set(entry.manifest.name, 'done');
        ordered.push(entry);
    };
    packages.forEach(visit);
    return ordered;
}

function onRegistry(name, version) {
    const result = spawnSync('npm', ['view', `${name}@${version}`, 'version', '--json'], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout.trim().length > 0) return true;
    if (/E404|404 Not Found/.test(`${result.stderr}${result.stdout}`)) return false;
    throw new Error(`Cannot determine whether ${name}@${version} is published: ${result.stderr.trim()}`);
}

const packages = inDependencyOrder(workspaces());
if (packages.length === 0) throw new Error('No publishable workspace packages found; refusing to report success.');

const scratch = mkdtempSync(join(tmpdir(), 'arc-publish-'));
const published = [];
const skipped = [];

try {
    for (const { path, manifest } of packages) {
        const label = `${manifest.name}@${manifest.version}`;
        if (onRegistry(manifest.name, manifest.version)) {
            console.log(`skip     ${label} (already on the registry)`);
            skipped.push(label);
            continue;
        }

        const tarball = join(scratch, `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`);
        execFileSync('yarn', ['pack', '--out', tarball], { cwd: path, stdio: 'inherit' });

        const args = ['publish', tarball, '--access', 'public'];
        if (inCi) args.push('--provenance');
        if (dryRun) args.push('--dry-run');
        console.log(`${dryRun ? 'dry-run ' : 'publish '} ${label}`);
        execFileSync('npm', args, { cwd: root, stdio: 'inherit' });
        published.push(label);
    }
} finally {
    rmSync(scratch, { recursive: true, force: true });
}

console.log(`${dryRun ? 'Dry run: would publish' : 'Published'} ${published.length}, skipped ${skipped.length}.`);
