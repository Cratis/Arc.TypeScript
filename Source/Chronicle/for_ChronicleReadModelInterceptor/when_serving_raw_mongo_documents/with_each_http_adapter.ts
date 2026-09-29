// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createServer, type Server } from 'node:http';
import express from 'express';
import fastify from 'fastify';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import type { IChronicleClient } from '@cratis/chronicle';
import { ArcApplication, CurrentValueSubject, defineObservableQuery, defineQuery } from '@cratis/arc.core';
import { cratisArc as expressArc } from '../../../Express/index.js';
import { cratisArc as fastifyArc } from '../../../Fastify/index.js';
import { cratisArc as honoArc } from '../../../Hono/index.js';
import '../../index.js';
import { given } from '../../given.js';
import { raw_mongo_documents } from '../../given/raw_mongo_documents.js';

const released = [{ _id: 'subject-1', name: 'plain' }];

for (const adapter of ['Express', 'Fastify', 'Hono'] as const) {
    describe(`when serving raw MongoDB documents of a protected read model through ${adapter}`, given(raw_mongo_documents, context => {
        let snapshot: { status: number; body: string };
        let page: { status: number; body: string };
        let observed: { status: number; frame: string };
        let failed: { status: number; body: string };
        beforeAll(async () => {
            const builder = ArcApplication.createBuilder({
                tenancy: { resolve: () => 'tenant-a' },
                queries: [
                    defineQuery({ name: 'RawPrivate', schema: z.object({}),
                        perform: (_, scope) => context.mongo.find(scope, {}) }),
                    defineQuery({ name: 'RawPrivatePage', schema: z.object({}),
                        perform: (_, scope, options) => context.mongo.queryPage(scope, {}, options) })
                ],
                observableQueries: [defineObservableQuery({ name: 'RawPrivateWatch', schema: z.object({}),
                    observe: async (_, scope) => CurrentValueSubject.of(await context.mongo.find(scope, {})) })]
            });
            builder.withChronicle({ eventStore: 'Test', client: { getEventStore: context.getStore } as unknown as IChronicleClient });
            builder.add(context.model);
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
                if (!address || typeof address === 'string') throw new Error('No HTTP port');
                const routes = [...application.server.endpoints.keys()];
                const route = (name: string) => {
                    const found = routes.find(candidate => candidate.endsWith(`/${name}`));
                    if (!found) throw new Error(`Route ${name} missing: ${routes.join(', ')}`);
                    return `http://127.0.0.1:${address.port}${found}`;
                };
                const read = async (url: string) => { const response = await fetch(url); return { status: response.status, body: await response.text() }; };
                snapshot = await read(route('raw-private'));
                page = await read(`${route('raw-private-page')}?page=0&pageSize=10`);
                const stream = await fetch(route('raw-private-watch'), { headers: { Accept: 'text/event-stream' }, signal: controller.signal });
                const reader = stream.body!.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                while (!buffer.replaceAll('\r\n', '\n').includes('\n\n')) {
                    const part = await reader.read();
                    if (part.done) throw new Error('SSE closed before result');
                    buffer += decoder.decode(part.value, { stream: true });
                }
                observed = { status: stream.status, frame: buffer.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5)).join('') };
                controller.abort();
                await reader.cancel().catch(() => {});
                context.release.rejects(new Error('release failed'));
                failed = await read(route('raw-private'));
            } finally {
                controller.abort();
                if (listener && adapter !== 'Fastify') await new Promise<void>((resolve, reject) =>
                    listener!.close(error => error ? reject(error) : resolve()));
                await stop();
                await application.dispose();
            }
        });
        it('should serve a released snapshot', () => {
            snapshot.status.should.equal(200);
            (JSON.parse(snapshot.body) as { data: object }).data.should.deep.equal(released);
        });
        it('should serve a released page', () => {
            page.status.should.equal(200);
            (JSON.parse(page.body) as { data: object }).data.should.deep.equal(released);
        });
        it('should stream a released emission', () => {
            observed.status.should.equal(200);
            (JSON.parse(observed.frame) as { data: object }).data.should.deep.equal(released);
        });
        it('should fail rather than serve ciphertext when release fails', () => {
            failed.status.should.not.equal(200);
            failed.body.should.not.contain('ciphertext');
        });
    }));
}
