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
export const scratch = process.env.ARC_RUNTIME_SCRATCH ?? resolve(root, '.ai-work/scratch/runtimes');
export const tool = name => process.env[`${name.toUpperCase()}_BIN`] ?? resolve(name === 'next' ? root : scratch, 'node_modules/.bin', name);
export function available(name) {
    const result = spawnSync(tool(name), ['--version'], { encoding: 'utf8' });
    if (result.error?.code === 'ENOENT') {
        console.error(`${name} runtime not installed (${tool(name)}); check not run`);
        process.exit(2);
    }
    if (result.error || result.status !== 0) {
        console.error(`${name} runtime failed (${tool(name)}): ${result.error ?? `exit ${result.status ?? `signal ${result.signal}`}`}\n${result.stdout ?? ''}${result.stderr ?? ''}`);
        process.exit(1);
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
    const deadline = AbortSignal.timeout(120_000);
    const child = spawn(binary, args, { cwd: options.cwd ?? root, env: { ...process.env, ...options.env },
        stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let launchError;
    const exited = new Promise(resolveExit => {
        child.once('exit', resolveExit);
        child.once('error', error => { launchError = error; resolveExit(); });
    });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output += data; });
    const stop = signal => {
        try { process.kill(-child.pid, signal); }
        catch (error) { if (error.code !== 'ESRCH') throw error; }
    };
    const withinDeadline = async work => {
        if (deadline.aborted) throw deadline.reason;
        let onAbort;
        const expired = new Promise((_, reject) => {
            onAbort = () => reject(deadline.reason);
            deadline.addEventListener('abort', onAbort, { once: true });
        });
        try { return await Promise.race([work(), expired]); }
        finally { deadline.removeEventListener('abort', onAbort); }
    };
    try {
        await withinDeadline(async () => {
            let ready = false;
            for (let attempt = 0; attempt < 80 && !deadline.aborted; attempt++) {
                if (launchError) throw launchError;
                if (child.exitCode !== null || child.signalCode !== null) break;
                try {
                    const response = await fetch(`${address}/api/all`, { headers: { 'x-cratis-tenant-id': 'north' },
                        signal: AbortSignal.any([deadline, AbortSignal.timeout(1000)]) });
                    if (response.status === 200) { ready = true; break; }
                } catch { /* Listener is still starting. */ }
                await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
            }
            if (!ready) throw Error(`Host did not become ready: ${output}`);
            await runScenario(request => fetch(new Request(address + new URL(request.url).pathname, request), {
                signal: AbortSignal.any([request.signal, deadline, AbortSignal.timeout(15_000)])
            }), options.scenario);
        });
        console.log(`${options.label}: Fetch scenario passed`);
    } catch (error) {
        console.error(output);
        throw error;
    } finally {
        if (child.pid) {
            stop('SIGTERM');
            let timer;
            const grace = new Promise(resolveDelay => { timer = setTimeout(() => resolveDelay(false), 3000); });
            const stopped = await Promise.race([exited.then(() => true), grace]);
            clearTimeout(timer);
            if (!stopped) stop('SIGKILL');
            await exited;
            // Next.js can leave descendants alive after its launcher exits.
            stop('SIGKILL');
        } else await exited;
    }
}
export { writeFile, rm, join };
