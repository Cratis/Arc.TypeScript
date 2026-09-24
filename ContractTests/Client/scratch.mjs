// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readdir, realpath, rmdir, unlink } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const repo = resolve(import.meta.dirname, '../..');
const base = join(repo, '.ai-work');
const owned = new Map();
const current = new AsyncLocalStorage();

export async function scratch() {
    const roots = current.getStore();
    assert.ok(roots, 'scratch must belong to a running client test');
    await mkdir(base, { recursive: true });
    assert.equal(await realpath(base), base, 'scratch parent must be a real directory');
    const root = await mkdtemp(join(base, 'client-generation-'));
    const stat = await lstat(root);
    owned.set(root, { dev: stat.dev, ino: stat.ino });
    roots.push(root);
    return root;
}

function run(command, args) {
    const result = spawnSync(command, args, { cwd: repo, encoding: 'utf8' });
    assert.equal(result.error, undefined, `${command} could not start`);
    assert.notEqual(result.status, null, `${command} did not exit normally`);
    return result;
}

function expectedFile(path) {
    const parent = basename(dirname(path));
    const file = basename(path);
    if (path.includes(`${sep}src${sep}node_modules${sep}@cratis${sep}arc.core${sep}`))
        return /^[A-Za-z][A-Za-z0-9_.-]*\.(?:js|ts|map|json)$/.test(file);
    if (path.includes(`${sep}src${sep}`)) return /^[A-Za-z][A-Za-z0-9_]*(?:\.proxy)?\.ts$/.test(file) || ['incorrect.ts', 'wrong.ts', 'tsconfig.json'].includes(file);
    if (path.includes(`${sep}dist${sep}`)) return /^[A-Za-z][A-Za-z0-9_]*(?:\.proxy)?\.js$/.test(file);
    return ['tsconfig.json', 'manifest.json', 'malicious.json', 'oversized.json', 'startup.mjs'].includes(file);
}

/** Only roots allocated by this process, with recognized test products, can be removed. */
export async function cleanupScratch(root) {
    const identity = owned.get(root);
    assert.ok(identity, 'refusing to clean a root not created by this test run');
    assert.equal(dirname(root), base);
    assert.match(basename(root), /^client-generation-[A-Za-z0-9]{6}$/);
    assert.equal(await realpath(base), base);
    assert.equal(await realpath(root), root, 'scratch root must not be a symlink');
    const stat = await lstat(root);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.dev === identity.dev && stat.ino === identity.ino && stat.uid === process.getuid(), 'scratch root ownership changed');
    const tracked = run('git', ['ls-files', '-z', '--', relative(repo, root)]);
    assert.equal(tracked.status, 0, tracked.stderr);
    assert.equal(tracked.stdout, '', 'tracked files must not be removed');
    const files = [];
    const directories = [];
    async function inspect(dir) {
        for (const entry of await readdir(dir)) {
            const path = join(dir, entry);
            assert.ok(path.startsWith(root + sep));
            const item = await lstat(path);
            assert.equal(item.isSymbolicLink(), false, `refusing to traverse a symlink: ${path}`);
            assert.equal(item.dev, identity.dev, 'scratch entry changed filesystem');
            if (item.isDirectory()) {
                const packageRoot = join(root, 'src/node_modules/@cratis/arc.core');
                assert.ok(dir === root ? ['src', 'dist'].includes(entry) :
                    path === join(root, 'src/node_modules') || path === join(root, 'src/node_modules/@cratis') || path === packageRoot ||
                    path.startsWith(packageRoot + sep) && /^[A-Za-z][A-Za-z0-9_.-]*$/.test(entry) ||
                    !path.includes(`${sep}node_modules${sep}`) && (dir.includes(`${sep}src`) || dir.includes(`${sep}dist`)) && /^[A-Za-z][A-Za-z0-9_]*$/.test(entry), `foreign directory: ${path}`);
                await inspect(path);
                directories.push(path);
            } else {
                assert.ok(item.isFile() && expectedFile(path), `foreign file: ${path}`);
                files.push(path);
            }
        }
    }
    await inspect(root); // Reject foreign entries before unlinking anything.
    const held = run('lsof', ['+D', root]);
    assert.equal(held.status, 1, `scratch root has an open file or lsof failed: ${held.stdout} ${held.stderr}`);
    assert.equal(held.stdout, '', 'lsof reported open files; retaining scratch');
    assert.equal(held.stderr, '', 'lsof did not complete a clean scan; retaining scratch');
    for (const path of files) await unlink(path);
    for (const path of directories) await rmdir(path);
    await rmdir(root);
    owned.delete(root);
}

/** Preserve all scratch roots when a test fails or is interrupted. */
export function clientTest(name, body) {
    return test(name, () => current.run([], async () => {
        await body(); // Includes joining workers and closing listeners/servers.
        for (const root of current.getStore()) await cleanupScratch(root);
    }));
}
