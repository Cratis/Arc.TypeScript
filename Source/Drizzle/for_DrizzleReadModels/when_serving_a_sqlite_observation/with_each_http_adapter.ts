// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createServer, type Server } from 'node:http';
import express from 'express';
import fastify from 'fastify';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { describe, it, should } from 'vitest';
import { ArcApplication, Severity } from '@cratis/arc.core';
import { cratisArc as expressArc } from '../../../Express/index.js';
import { cratisArc as fastifyArc } from '../../../Fastify/index.js';
import { cratisArc as honoArc } from '../../../Hono/index.js';
import { DrizzleDialect, DrizzleObservation } from '../../index.js';
import { DrizzleChangeNotifications } from '../../DrizzleChangeNotifications.js';
import { TaskRecord } from '../given/TaskRecord.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';
import { AddObservedTask } from '../given/AddObservedTask.js';
import { ObservedTaskQueries } from '../given/ObservedTaskQueries.js';

should();
for (const adapter of ['Express', 'Fastify', 'Hono'] as const) {
    describe(`when serving SQLite observation through ${adapter}`, () => {
        it('should serve a current GET and stream a command change until disconnect', async () => {
            const fixture = new a_sqlite_database();
            await fixture.establish();
            const builder = ArcApplication.createBuilder({ tenancy: { resolve: () => 'default' } });
            builder.add(AddObservedTask, ObservedTaskQueries).withDrizzle({ dialect: DrizzleDialect.SQLite,
                database: fixture.database, readModels: [{ type: TaskRecord, table: fixture.table }],
                observation: DrizzleObservation.InProcess });
            const application = await builder.build();
            let listener: Server | undefined;
            let stop: () => Promise<void> = async () => {};
            const controller = new AbortController();
            try {
                if (adapter === 'Express') {
                    const host = express();
                    host.use(expressArc(application));
                    listener = createServer(host);
                    await new Promise<void>(resolve => listener!.listen(0, '127.0.0.1', resolve));
                } else if (adapter === 'Fastify') {
                    const host = fastify();
                    host.register(fastifyArc, { arc: application });
                    await host.listen({ port: 0, host: '127.0.0.1' });
                    listener = host.server as Server;
                    stop = () => host.close();
                } else {
                    const host = new Hono();
                    host.use(honoArc(application));
                    listener = serve({ fetch: host.fetch, port: 0, hostname: '127.0.0.1' }) as Server;
                    if (!listener.listening) await new Promise<void>(resolve => listener!.once('listening', resolve));
                }
                const address = listener.address();
                if (!address || typeof address === 'string') throw Error('No HTTP port');
                const routes = [...application.server.endpoints.keys()];
                const page = routes.find(route => route.endsWith('/page'));
                const command = routes.find(route => route.endsWith('/add-observed-task'));
                if (!page || !command) throw Error(`Observation routes missing: ${routes.join(', ')}`);
                const base = `http://127.0.0.1:${address.port}`;
                const url = `${base}${page}?page=0&pageSize=10`;
                const snapshot = await fetch(url);
                snapshot.status.should.equal(200);
                const initial = await snapshot.json() as { paging: { totalItems: number } };
                initial.paging.totalItems.should.equal(2);
                const response = await fetch(url, { headers: { Accept: 'text/event-stream' }, signal: controller.signal });
                response.status.should.equal(200);
                const reader = response.body!.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                const nextFrame = async (): Promise<{ paging: { totalItems: number } }> => {
                    while (true) {
                        const boundary = buffer.indexOf('\n\n');
                        if (boundary >= 0) {
                            const frame = buffer.slice(0, boundary);
                            buffer = buffer.slice(boundary + 2);
                            const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5)).join('');
                            if (data) return JSON.parse(data) as { paging: { totalItems: number } };
                            continue;
                        }
                        const part = await reader.read();
                        if (part.done) throw Error('SSE closed before result');
                        buffer += decoder.decode(part.value, { stream: true }).replaceAll('\r\n', '\n');
                    }
                };
                (await nextFrame()).paging.totalItems.should.equal(2);
                const written = await fetch(`${base}${command}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: '21112233-4455-6677-8899-aabbccddeeff', title: 'new' }) });
                written.status.should.equal(200);
                (await nextFrame()).paging.totalItems.should.equal(3);
                const busScope = application.server.services.createScope({ tenantId: 'default', principal: undefined,
                    allowedSeverity: Severity.Warning, correlationId: crypto.randomUUID(), signal: new AbortController().signal });
                const notifications = await busScope.resolve(DrizzleChangeNotifications);
                notifications.listenerCount('default').should.equal(1);
                controller.abort();
                await reader.cancel().catch(() => {});
                const deadline = Date.now() + 2000;
                while (notifications.listenerCount('default') && Date.now() < deadline)
                    await new Promise<void>(resolve => setTimeout(resolve, 10));
                notifications.listenerCount('default').should.equal(0);
                await busScope.dispose();
            } finally {
                controller.abort();
                if (listener && adapter !== 'Fastify') await new Promise<void>((resolve, reject) =>
                    listener!.close(error => error ? reject(error) : resolve()));
                await stop();
                await application.dispose();
                fixture.close();
            }
        });
    });
}
