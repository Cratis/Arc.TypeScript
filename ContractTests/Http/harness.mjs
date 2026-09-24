// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const startupTimeout = 30_000;
const shutdownTimeout = 5_000;

const children = new Set();
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
        for (const child of children) child.kill('SIGTERM');
        setTimeout(() => {
            for (const child of children) child.kill('SIGKILL');
        }, shutdownTimeout).unref();
        process.exitCode = 128 + (signal === 'SIGINT' ? 2 : 15);
    });
}
process.once('exit', () => { for (const child of children) child.kill('SIGTERM'); });

export async function startServer(command, args, options = {}) {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    let stdout = '';
    let stderr = '';
    let pending = '';
    let wake;
    const exited = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    exited.finally(() => children.delete(child)).catch(() => children.delete(child));
    const ready = new Promise(resolve => { wake = resolve; });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
        stdout = (stdout + chunk).slice(-32_768);
        pending = (pending + chunk).slice(-32_768);
        const lines = pending.split(/\r?\n/);
        pending = lines.pop();
        for (const line of lines) {
            try {
                const value = JSON.parse(line);
                if (value?.kind === options.kind && typeof value.baseUrl === 'string') {
                    const url = new URL(value.baseUrl);
                    if (url.protocol === 'http:' && url.hostname === '127.0.0.1' && Number(url.port) > 0) wake(value);
                }
            } catch { /* Non-readiness log line. */ }
        }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-32_768); });
    const diagnostics = () => `stdout:\n${stdout}\nstderr:\n${stderr}`;
    const stop = async () => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        child.kill('SIGTERM');
        if (await Promise.race([exited.then(() => true), delay(shutdownTimeout, undefined, { ref: false }).then(() => false)]) === false) {
            child.kill('SIGKILL');
            await exited;
        }
    };
    try {
        const readiness = await Promise.race([
            ready,
            exited.then(({ code, signal }) => { throw new Error(`${command} exited (${code ?? signal}) before readiness JSON. ${diagnostics()}`); }),
            delay(startupTimeout, undefined, { ref: false }).then(() => { throw new Error(`${command} timed out before readiness JSON. ${diagnostics()}`); })
        ]);
        return { url: readiness.baseUrl, readiness, stop, diagnostics };
    } catch (cause) {
        try { await stop(); } catch { /* Preserve the startup failure. */ }
        throw cause;
    }
}

export async function request(url, method, path, body, headers = {}) {
    const response = await fetch(new URL(path, url), {
        method,
        headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(10_000)
    });
    const text = await response.text();
    let json;
    if (text) {
        try { json = JSON.parse(text); } catch { json = undefined; }
    }
    return { status: response.status, headers: Object.fromEntries(response.headers), body: json ?? text };
}

// Only a generated correlation ID from an invalid request is replaced after its
// UUID shape and header/body agreement are asserted. No envelope keys are dropped.
export function normalize(actual, { randomCorrelation = false, headers = [] } = {}) {
    const body = structuredClone(actual.body);
    const selectedHeaders = Object.fromEntries(headers.map(name => {
        assert.ok(Object.hasOwn(actual.headers, name), `${name} response header required`);
        return [name, actual.headers[name]];
    }));
    if (randomCorrelation) {
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        assert.match(body.correlationId, uuid, 'invalid correlation replaced with UUID');
        assert.equal(selectedHeaders['x-correlation-id'], body.correlationId, 'generated correlation echoed in header and body');
        assert.notEqual(body.correlationId, '00000000-0000-0000-0000-000000000000');
        body.correlationId = '<generated UUID>';
        selectedHeaders['x-correlation-id'] = '<generated UUID>';
    }
    return { status: actual.status, body, headers: selectedHeaders };
}
