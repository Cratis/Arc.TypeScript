// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, CurrentValueSubject, defineObservableQuery, exportClientManifest } from '../src/index.js';

should();

function server(): ArcServer {
    return new ArcServer({ enableObservableHealth: true,
        authentication: [request => {
            const id = request.headers.get('authorization');
            return id === 'alice' || id === 'bob'
                ? { status: AuthenticationStatus.Authenticated, principal: { id, roles: [], isAuthenticated: true } }
                : { status: AuthenticationStatus.Anonymous };
        }], observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => new CurrentValueSubject([1])
        })] });
}

describe('caller-scoped observable query health', () => {
    it('should leave the endpoint unregistered unless explicitly enabled', async () => {
        const arc = new ArcServer({});
        should().equal(arc.endpoints.has('/.cratis/queries/health'), false);
        should().equal(await arc.handle(new Request('http://localhost/.cratis/queries/health')), null);
        await arc.dispose();
    });

    it('should omit the built-in health query from an application client manifest', async () => {
        const arc = new ArcServer({ enableObservableHealth: true, observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), clientOutput: { output: {
                kind: 'array', element: { kind: 'number' }
            } }, observe: () => new CurrentValueSubject([1])
        })] });
        exportClientManifest(arc).operations.map(operation => operation.id).should.deep.equal(['Numbers']);
        await arc.dispose();
    });

    it('should deny anonymous health requests without revealing connection metadata', async () => {
        const arc = server();
        const response = await arc.handle(new Request('http://localhost/.cratis/queries/health'));
        response?.status.should.equal(401);
        await arc.dispose();
    });

    it('should bound authenticated SSE hub connections per caller', async () => {
        const arc = server();
        const streams: Response[] = [];
        for (let index = 0; index < 8; index++) {
            const opened = await arc.handle(new Request('http://localhost/.cratis/queries/sse', {
                headers: { authorization: 'alice' }
            }));
            opened?.status.should.equal(200);
            streams.push(opened!);
        }
        const limited = await arc.handle(new Request('http://localhost/.cratis/queries/sse', {
            headers: { authorization: 'alice' }
        }));
        limited?.status.should.equal(503);
        limited?.headers.get('retry-after')?.should.equal('1');
        for (const stream of streams) await stream.body?.cancel();
        await arc.dispose();
    });

    it('should stream health updates when subscriptions are admitted', async () => {
        const arc = server();
        const health = await arc.handle(new Request('http://localhost/.cratis/queries/health', {
            headers: { authorization: 'alice', accept: 'text/event-stream' }
        }));
        const reader = health!.body!.getReader();
        const decode = (bytes?: Uint8Array): { data: { totalSubscriptions: number } } =>
            JSON.parse(new TextDecoder().decode(bytes).slice(6)) as { data: { totalSubscriptions: number } };
        decode((await reader.read()).value).data.totalSubscriptions.should.equal(0);
        const events = await arc.handle(new Request('http://localhost/.cratis/queries/sse', {
            headers: { authorization: 'alice' }
        }));
        const eventReader = events!.body!.getReader();
        const connected = JSON.parse(new TextDecoder().decode((await eventReader.read()).value).slice(6));
        const subscribed = await arc.handle(new Request('http://localhost/.cratis/queries/sse/subscribe', {
            method: 'POST', headers: { authorization: 'alice', 'content-type': 'application/json' },
            body: JSON.stringify({ connectionId: connected.payload, queryId: 'q', revision: 1,
                request: { queryName: 'Numbers' } })
        }));
        subscribed?.status.should.equal(200);
        let latest = 0;
        for (let index = 0; index < 4 && latest === 0; index++)
            latest = decode((await reader.read()).value).data.totalSubscriptions;
        latest.should.equal(1);
        await reader.cancel();
        await eventReader.cancel();
        await arc.dispose();
    });

    it('should report .NET-shaped hub counts only to the caller that owns the connection', async () => {
        const arc = server();
        const events = await arc.handle(new Request('http://localhost/.cratis/queries/sse', {
            headers: { authorization: 'alice' }
        }));
        const reader = events!.body!.getReader();
        const connected = JSON.parse(new TextDecoder().decode((await reader.read()).value).slice(6));
        connected.type.should.equal('Connected');
        const subscribed = await arc.handle(new Request('http://localhost/.cratis/queries/sse/subscribe', {
            method: 'POST', headers: { authorization: 'alice', 'content-type': 'application/json' },
            body: JSON.stringify({ connectionId: connected.payload, queryId: 'q', revision: 1,
                request: { queryName: 'Numbers' } })
        }));
        subscribed?.status.should.equal(200);
        const alice = await arc.handle(new Request('http://localhost/.cratis/queries/health', {
            headers: { authorization: 'alice' }
        }));
        alice?.status.should.equal(200);
        const details = (await alice!.json()).data;
        details.totalConnections.should.equal(1);
        details.totalSubscriptions.should.equal(1);
        details.querySubscriptions[0].queryName.should.equal('Numbers');
        details.connections[0].subscriptions[0].clientInfo.userId.should.equal('alice');
        should().equal(details.connections[0].subscriptions[0].clientInfo.remoteIpAddress, null);
        const bob = await arc.handle(new Request('http://localhost/.cratis/queries/health', {
            headers: { authorization: 'bob' }
        }));
        (await bob!.json()).data.totalConnections.should.equal(0);
        await reader.cancel();
        await arc.dispose();
    });
});
