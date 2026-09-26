// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
should();

const count = (frame: Uint8Array | undefined): number =>
    (JSON.parse(new TextDecoder().decode(frame).slice(6)) as { data: { totalConnections: number } }).data.totalConnections;

describe('when another caller has a live hub connection before health admission', () => {
    let server: ArcServer;
    const readers: ReadableStreamDefaultReader<Uint8Array>[] = [];
    let bobSnapshot: number;
    let snapshot: number;
    let initial: number;
    let changed: number;
    beforeEach(async () => {
        readers.length = 0;
        server = new ArcServer({
            query: { enableObservableHealth: true },
            authentication: [request => {
                const id = request.headers.get('authorization');
                return id === 'alice' || id === 'bob'
                    ? { status: AuthenticationStatus.Authenticated, principal: { id, roles: [], isAuthenticated: true } }
                    : { status: AuthenticationStatus.Anonymous };
            }]
        });
        const hub = async (id: string) => {
            const response = await server.handle(new Request('http://localhost/.cratis/queries/sse', {
                headers: { authorization: id }
            }));
            const reader = response!.body!.getReader();
            readers.push(reader);
            await reader.read();
        };
        await hub('bob');
        const health = (id: string, stream = false) => server.handle(new Request('http://localhost/.cratis/queries/health', {
            headers: { authorization: id, ...(stream ? { accept: 'text/event-stream' } : {}) }
        }));
        bobSnapshot = ((await (await health('bob'))!.json()) as { data: { totalConnections: number } }).data.totalConnections;
        snapshot = ((await (await health('alice'))!.json()) as { data: { totalConnections: number } }).data.totalConnections;
        const response = await health('alice', true);
        const reader = response!.body!.getReader();
        readers.push(reader);
        initial = count((await reader.read()).value);
        await hub('alice');
        changed = count((await reader.read()).value);
    });
    afterEach(async () => {
        try { await Promise.all(readers.map(reader => reader.cancel())); }
        finally { await server.dispose(); }
    });
    it('should omit Bob from Alice\'s snapshot and first stream emission', () => {
        bobSnapshot.should.equal(1);
        snapshot.should.equal(0);
        initial.should.equal(0);
    });
    it('should count Alice\'s connection without including Bob\'s', () => {
        changed.should.equal(1);
    });
});
