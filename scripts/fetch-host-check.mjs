// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { runScenario } from './fetch-runtime-scenario.mjs';

export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const scratch = process.env.ARC_RUNTIME_SCRATCH ?? resolve(root, '../../scratch/runtimes');
export const tool = name => process.env[`${name.toUpperCase()}_BIN`] ?? resolve(scratch, 'node_modules/.bin', name);
export function available(name) {
    const result = spawnSync(tool(name), ['--version'], { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
        console.error(`${name} runtime not installed (${tool(name)}); check not run`);
        process.exit(2);
    }
    return result.stdout.trim();
}
export async function workspace(name) {
    await mkdir(scratch, { recursive: true });
    return mkdtemp(join(scratch, `arc-${name}-`));
}
export async function bundle(directory) {
    const output = join(directory, 'arc.mjs');
    await build({ entryPoints: [resolve(root, 'scripts/fetch-runtime-scenario.mjs')], bundle: true,
        platform: 'neutral', format: 'esm', external: ['node:async_hooks'], outfile: output });
    return output;
}
export async function port() {
    const server = createServer();
    await new Promise((resolveReady, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolveReady));
    const value = server.address().port;
    await new Promise(resolveClosed => server.close(resolveClosed));
    return value;
}
export async function checkHost(binary, args, address, options = {}) {
    const child = spawn(binary, args, { cwd: options.cwd ?? root, env: { ...process.env, ...options.env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output += data; });
    try {
        let ready = false;
        for (let attempt = 0; attempt < 80; attempt++) {
            if (child.exitCode !== null) break;
            try {
                const response = await fetch(`${address}/api/all`, { headers: { 'x-cratis-tenant-id': 'north' }, signal: AbortSignal.timeout(1000) });
                if (response.status === 200) { ready = true; break; }
            } catch { /* Listener is still starting. */ }
            await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
        }
        if (!ready) throw Error(`Host did not become ready: ${output}`);
        await runScenario(request => fetch(new Request(address + new URL(request.url).pathname, request)), options.scenario);
        console.log(`${options.label}: Fetch scenario passed`);
    } catch (error) {
        console.error(output);
        throw error;
    } finally {
        child.kill('SIGTERM');
        await Promise.race([new Promise(resolveExit => child.once('exit', resolveExit)),
            new Promise(resolveDelay => setTimeout(resolveDelay, 3000))]);
        if (child.exitCode === null) child.kill('SIGKILL');
    }
}
export { writeFile, rm, join };
