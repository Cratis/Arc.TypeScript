// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { AuthenticationStatus } from '../../../authentication/AuthenticationStatus.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';

should();

const path = 'http://localhost/.cratis/queries/sse';

describe('when controlling an anonymous SSE connection', () => {
    let server: ArcServer;
    let stream: Response;
    let connectionId: string;
    let called: number;
    let reader: ReadableStreamDefaultReader<Uint8Array>;
    let draining: Promise<void>;

    beforeEach(async () => {
        called = 0;
        server = new ArcServer({ authentication: [request => request.headers.get('authorization') === 'Bearer alice'
            ? { status: AuthenticationStatus.Authenticated, principal: { id: 'alice', isAuthenticated: true, roles: [] } }
            : { status: AuthenticationStatus.Anonymous }],
        query: { maxObservableHubConnectionsPerCaller: 1 },
        observableQueries: [
            defineObservableQuery({ name: 'Public', schema: z.object({}), observe: () => {
                called++; return CurrentValueSubject.of([1]);
            } }),
            defineObservableQuery({ name: 'Private', schema: z.object({}), authorization: { roles: ['reader'] },
                observe: () => { called++; return CurrentValueSubject.of([2]); } })
        ] });
        stream = (await server.handle(new Request(path), { remoteAddress: '10.0.0.1' }))!;
        reader = stream.body!.getReader();
        const frame = new TextDecoder().decode((await reader.read()).value);
        connectionId = JSON.parse(frame.slice(6)).payload;
        draining = (async () => { while (!(await reader.read()).done) { /* Keep control frames flowing. */ } })();
    });

    afterEach(async () => {
        await reader.cancel();
        await draining;
        await server.dispose();
    });

    const control = async (route: 'subscribe' | 'unsubscribe', queryId: string, options: {
        address?: string; authorization?: string; origin?: string; tenant?: string; contentType?: string;
    } = {}): Promise<number> => {
        const response = await server.handle(new Request(`${path}/${route}`, { method: 'POST',
            headers: { 'content-type': options.contentType ?? 'application/json',
                ...(options.authorization ? { authorization: options.authorization } : {}),
                ...(options.origin ? { origin: options.origin } : {}),
                ...(options.tenant ? { 'x-cratis-tenant-id': options.tenant } : {}) },
            body: JSON.stringify({ connectionId, queryId, revision: 1,
                ...(route === 'subscribe' ? { request: { queryName: queryId } } : {}) })
        }), options.address === undefined ? undefined : { remoteAddress: options.address });
        return response!.status;
    };

    it('should accept anonymous control from the opening address and preserve query authorization', async () => {
        (await control('subscribe', 'Public', { address: '10.0.0.1' })).should.equal(200);
        (await control('subscribe', 'Private', { address: '10.0.0.1' })).should.equal(401);
        called.should.equal(1);
        (await control('unsubscribe', 'Public', { address: '10.0.0.1' })).should.equal(200);
    });

    it('should hide the connection from another address, an absent address, authenticated callers and another tenant', async () => {
        (await control('subscribe', 'Public', { address: '10.0.0.2' })).should.equal(404);
        (await control('unsubscribe', 'Public')).should.equal(404);
        (await control('subscribe', 'Public', { address: '10.0.0.1', authorization: 'Bearer alice' })).should.equal(404);
        (await control('unsubscribe', 'Public', { address: '10.0.0.1', tenant: 'other' })).should.equal(404);
        called.should.equal(0);
    });

    it('should reject unsafe control content and origins before executing a subscription', async () => {
        (await control('subscribe', 'Public', { address: '10.0.0.1', contentType: 'text/plain' })).should.equal(415);
        (await control('subscribe', 'Public', { address: '10.0.0.1', origin: 'https://evil.example' })).should.equal(403);
        called.should.equal(0);
    });

    it('should apply a per-caller subscription budget across anonymous connections', async () => {
        const limitedServer = new ArcServer({ query: { maxObservableSubscriptionsPerCaller: 1 },
            observableQueries: [defineObservableQuery({ name: 'Public', schema: z.object({}),
                observe: () => CurrentValueSubject.of([1]) })] });
        const streams: ReadableStreamDefaultReader<Uint8Array>[] = [];
        try {
            const ids: string[] = [];
            for (let index = 0; index < 2; index++) {
                const response = (await limitedServer.handle(new Request(path), { remoteAddress: '10.0.0.1' }))!;
                const streamReader = response.body!.getReader();
                streams.push(streamReader);
                ids.push(JSON.parse(new TextDecoder().decode((await streamReader.read()).value).slice(6)).payload);
                void (async () => { while (!(await streamReader.read()).done) { /* Drain SSE frames. */ } })();
            }
            const subscribe = (id: string) => limitedServer.handle(new Request(`${path}/subscribe`, {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ connectionId: id, queryId: 'q', request: { queryName: 'Public' } })
            }), { remoteAddress: '10.0.0.1' });
            (await subscribe(ids[0]!))?.status.should.equal(200);
            (await subscribe(ids[1]!))?.status.should.equal(503);
        } finally {
            for (const streamReader of streams) await streamReader.cancel();
            await limitedServer.dispose();
        }
    });

    it('should apply a per-caller connection budget to anonymous peers', async () => {
        const limited = await server.handle(new Request(path), { remoteAddress: '10.0.0.1' });
        limited?.status.should.equal(503);
        const other = await server.handle(new Request(path), { remoteAddress: '10.0.0.2' });
        other?.status.should.equal(200);
        await other?.body?.cancel();
    });

    it('should group anonymous connections without an address under one budget', async () => {
        const anonymous = (await server.handle(new Request(path)))!;
        anonymous.status.should.equal(200);
        const another = await server.handle(new Request(path));
        another?.status.should.equal(503);
        const anonymousReader = anonymous.body!.getReader();
        const frame = new TextDecoder().decode((await anonymousReader.read()).value);
        const anonymousId = JSON.parse(frame.slice(6)).payload;
        const accepted = await server.handle(new Request(`${path}/unsubscribe`, { method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ connectionId: anonymousId, queryId: 'Public' }) }));
        accepted?.status.should.equal(200);
        await anonymousReader.cancel();
    });

    it('should not allow an anonymous request to control an authenticated connection', async () => {
        const authenticated = (await server.handle(new Request(path, {
            headers: { authorization: 'Bearer alice' }
        }), { remoteAddress: '10.0.0.1' }))!;
        const authenticatedReader = authenticated.body!.getReader();
        const frame = new TextDecoder().decode((await authenticatedReader.read()).value);
        const authenticatedId = JSON.parse(frame.slice(6)).payload;
        const unsubscribe = (authorization?: string) => server.handle(new Request(`${path}/unsubscribe`, {
            method: 'POST', headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
            body: JSON.stringify({ connectionId: authenticatedId, queryId: 'Public' })
        }), { remoteAddress: '10.0.0.2' });
        (await unsubscribe())?.status.should.equal(404);
        (await unsubscribe('Bearer alice'))?.status.should.equal(200);
        await authenticatedReader.cancel();
    });
});
