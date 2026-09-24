// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import fastify from 'fastify';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { ArcServer, CommandOperation, defineCommand, tuple } from '@cratis/arc.core';
import { mountExpress } from '@cratis/arc.express';
import { mountFastify } from '@cratis/arc.fastify';
import { mountHono } from '@cratis/arc.hono';

async function host(kind, server) {
    if (kind === 'express') {
        const app = express(); mountExpress(app, server);
        const listener = app.listen(0, '127.0.0.1');
        await new Promise(resolve => listener.once('listening', resolve));
        return { origin: `http://127.0.0.1:${listener.address().port}`, close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())) };
    }
    if (kind === 'fastify') {
        const app = fastify(); mountFastify(app, server);
        await app.listen({ port: 0, host: '127.0.0.1' });
        return { origin: app.listeningOrigin, close: () => app.close() };
    }
    const app = new Hono(); mountHono(app, server);
    const listener = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
    await new Promise(resolve => listener.once('listening', resolve));
    return { origin: `http://127.0.0.1:${listener.address().port}`, close: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())) };
}

for (const adapter of ['express', 'fastify', 'hono']) test(`returned operations are server-only on ${adapter}`, async () => {
    const executed = [];
    let reject = false;
    class Probe extends CommandOperation {
        execute(signal) { void signal; executed.push('execute'); if (reject) throw Error('execution failed'); }
        compensate(failure, signal) { void failure; void signal; executed.push('compensate'); }
    }
    const server = new ArcServer({ commands: [defineCommand({ name: 'DoWork', schema: z.object({}),
        handle: () => tuple({ id: 'visible' }, new Probe()) })] });
    const listening = await host(adapter, server);
    try {
        const request = () => fetch(`${listening.origin}/api/do-work`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        const success = await request();
        assert.equal(success.status, 200);
        assert.deepEqual((await success.json()).response, { id: 'visible' });
        reject = true;
        const failed = await request();
        assert.equal(failed.status, 500);
        const body = await failed.json();
        assert.equal(body.response, undefined);
        assert.equal(JSON.stringify(body).includes('recovery'), false);
        assert.deepEqual(executed, ['execute', 'execute', 'compensate']);
    } finally { await listening.close(); await server.dispose(); }
});
