// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createServer, type Server } from 'node:http';
import express from 'express';
import fastify from 'fastify';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { beforeEach, afterEach, describe, it, should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import { mountExpress } from '../../../Express/index.js';
import { mountFastify } from '../../../Fastify/index.js';
import { mountHono } from '../../../Hono/index.js';
import '../../index.js';
import { given } from '../../given.js';
import { TaskQueries } from '../given/TaskQueries.js';
import { TaskRecord } from '../given/TaskRecord.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';

should();
for (const adapter of ['Express', 'Fastify', 'Hono'] as const) {
    describe(`when serving a SQLite page through ${adapter}`, given(a_sqlite_database, context => {
        let status: number;
        let unknown: number;
        let data: { data: { title: string }[]; paging: { totalItems: number } };
        beforeEach(async () => {
            const builder = ArcApplication.createBuilder({ resolveTenant: () => 'default' });
            builder.add(TaskQueries).addDrizzle({ dialect: 'sqlite', database: context.database,
                readModels: [{ type: TaskRecord, table: context.table }] });
            const application = await builder.build();
            let listener: Server | undefined;
            let stop: () => Promise<void> = async () => {};
            try {
                if (adapter === 'Express') {
                    const host = express();
                    mountExpress(host, application);
                    listener = createServer(host);
                    await new Promise<void>(resolve => listener!.listen(0, '127.0.0.1', resolve));
                } else if (adapter === 'Fastify') {
                    const host = fastify();
                    mountFastify(host, application);
                    await host.listen({ port: 0, host: '127.0.0.1' });
                    listener = host.server as Server;
                    stop = () => host.close();
                } else {
                    const host = new Hono();
                    mountHono(host, application);
                    listener = serve({ fetch: host.fetch, port: 0, hostname: '127.0.0.1' }) as Server;
                    if (!listener.listening) await new Promise<void>(resolve => listener!.once('listening', resolve));
                }
                const address = listener.address();
                if (!address || typeof address === 'string') throw new Error('No HTTP port');
                const route = [...application.server.endpoints.keys()].find(path => path.endsWith('/page'));
                if (!route) throw new Error('SQL page route was not registered');
                const url = `http://127.0.0.1:${address.port}${route}?page=0&pageSize=1&sortBy=`;
                const response = await fetch(`${url}title&sortDirection=ascending`);
                status = response.status;
                data = await response.json();
                unknown = (await fetch(`${url}unknown&sortDirection=ascending`)).status;
            } finally {
                if (listener && adapter !== 'Fastify') await new Promise<void>((resolve, reject) =>
                    listener!.close(error => error ? reject(error) : resolve()));
                await stop();
                await application.dispose();
            }
        });
        afterEach(() => context.close());
        it('should push sorting and paging into SQL and preserve the unsliced total', () => {
            status.should.equal(200);
            data.data[0]!.title.should.equal('a');
            data.paging.totalItems.should.equal(2);
        });
        it('should reject unknown sort fields with HTTP 400', () => unknown.should.equal(400));
    }));
}
