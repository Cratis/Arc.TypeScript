// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createServer, type Server } from 'node:http';
import express from 'express';
import fastify from 'fastify';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import { Guid } from '@cratis/fundamentals';
import { mountExpress } from '../../../Express/index.js';
import { mountFastify } from '../../../Fastify/index.js';
import { mountHono } from '../../../Hono/index.js';
import { given } from '../../given.js';
import { mongoCollection } from '../../index.js';
import { a_replica_set } from '../given/a_replica_set.js';
import { TaskQueries } from '../given/TaskQueries.js';
import { TaskRecord } from '../given/TaskRecord.js';

should();
for (const adapter of ['Express', 'Fastify', 'Hono'] as const) {
    describe(`when serving a paged MongoDB query through ${adapter}`, given(a_replica_set, context => {
        let result: { data: { title: string }[]; paging: { totalItems: number } };
        let status: number;
        beforeEach(async () => {
            if (!process.env.ARC_MONGO_TEST_URI) throw new Error('ARC_MONGO_TEST_URI is required');
            await context.client.connect();
            const builder = ArcApplication.createBuilder({ resolveTenant: () => 'a' });
            builder.add(TaskQueries).addMongoDB({ client: context.client, databaseNameResolver: tenant => `${context.name}_${tenant}`,
                readModels: [TaskRecord] });
            const application = await builder.build();
            const scope = application.server.services.createScope(context.context('a'));
            try {
                const collection = await scope.resolve(mongoCollection(TaskRecord));
                await collection.native.insertMany([
                    collection.codec.serialize(Object.assign(new TaskRecord(), {
                        id: Guid.parse('00112233-4455-6677-8899-aabbccddeeff'), title: 'z'
                    })),
                    collection.codec.serialize(Object.assign(new TaskRecord(), {
                        id: Guid.parse('11112233-4455-6677-8899-aabbccddeeff'), title: 'a'
                    }))
                ]);
            } finally { await scope.dispose(); }
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
                    const hosted = serve({ fetch: host.fetch, port: 0, hostname: '127.0.0.1' });
                    listener = hosted as Server;
                    if (!hosted.listening) await new Promise<void>(resolve => hosted.once('listening', resolve));
                }
                if (!listener) throw new Error('No HTTP listener');
                const address = listener.address();
                if (!address || typeof address === 'string') throw new Error('No HTTP port');
                const route = [...application.server.endpoints.keys()].find(path => path.endsWith('/page'));
                if (!route) throw new Error('MongoDB page route was not registered');
                const response = await fetch(`http://127.0.0.1:${address.port}${route}?page=0&pageSize=1&sortBy=title&sortDirection=ascending`);
                status = response.status;
                result = await response.json();
            } finally {
                if (listener && adapter !== 'Fastify') await new Promise<void>((resolve, reject) =>
                    listener!.close(error => error ? reject(error) : resolve()));
                await stop();
                await application.dispose();
            }
        });
        afterEach(async () => {
            try { await context.client.db(`${context.name}_a`).dropDatabase(); }
            finally { await context.client.close(); }
        });
        it('should return provider-sorted items and the unsliced count over HTTP', () => {
            status.should.equal(200);
            result.data[0]!.title.should.equal('a');
            result.paging.totalItems.should.equal(2);
        });
    }));
}
