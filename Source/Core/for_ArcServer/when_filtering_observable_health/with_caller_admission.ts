// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import type { QueryContext } from '../../queries/QueryContext.js';
import { unauthorizedQueryResult } from '../../queries/unauthorizedQueryResult.js';
should();

describe('when filtering observable health by caller at admission', () => {
    let server: ArcServer;
    let names: (string | undefined)[];
    let ordinaryNames: (string | undefined)[];
    let denial: number;
    let deniedSubscription: number;
    let allowed: { totalConnections: number };
    let emissions: number;
    let ownHealth: { totalConnections: number };
    beforeEach(async () => {
        names = [];
        ordinaryNames = [];
        class Ordinary { onPerform(context: QueryContext) { ordinaryNames.push(context.operationName); } }
        class Gate {
            onPerform(context: QueryContext) {
                names.push(context.operationName);
                if (context.operationName === 'QueryHealth.ObserveHealth' && context.principal?.id === 'bob')
                    return unauthorizedQueryResult(context);
            }
        }
        server = new ArcServer({
            query: { enableObservableHealth: true },
            authentication: [request => {
                const id = request.headers.get('authorization');
                return id === 'alice' || id === 'bob'
                    ? { status: AuthenticationStatus.Authenticated, principal: { id, roles: [], isAuthenticated: true } }
                    : { status: AuthenticationStatus.Anonymous };
            }],
            services: [{ token: Gate, lifetime: ServiceLifetime.Scoped, factory: () => new Gate() },
                { token: Ordinary, lifetime: ServiceLifetime.Scoped, factory: () => new Ordinary() }],
            authorizationQueryFilters: [Gate], queryPipelineFilters: [Ordinary]
        });
        const request = (id: string, stream = false) => new Request('http://localhost/.cratis/queries/health', {
            headers: { authorization: id, ...(stream ? { accept: 'text/event-stream' } : {}) }
        });
        denial = (await server.handle(request('bob')))?.status ?? 0;
        deniedSubscription = (await server.handle(request('bob', true)))?.status ?? 0;
        const health = await server.handle(request('alice', true));
        const reader = health!.body!.getReader();
        const initial = await reader.read();
        allowed = JSON.parse(new TextDecoder().decode(initial.value).slice(6)).data;
        const hub = await server.handle(new Request('http://localhost/.cratis/queries/sse', {
            headers: { authorization: 'alice' }
        }));
        const hubReader = hub!.body!.getReader();
        await hubReader.read();
        // The hub connection publishes a health change without re-admitting the health stream.
        const updated = await reader.read();
        ownHealth = JSON.parse(new TextDecoder().decode(updated.value).slice(6)).data as { totalConnections: number };
        emissions = names.filter(name => name === 'QueryHealth.ObserveHealth').length;
        await hubReader.cancel();
        await reader.cancel();
    });
    afterEach(async () => { await server.dispose(); });
    it('should deny the caller on snapshot and direct SSE', () => {
        denial.should.equal(403);
        deniedSubscription.should.equal(403);
    });
    it('should identify health and admit the allowed caller only once per stream', () => {
        names.should.contain('QueryHealth.ObserveHealth');
        emissions.should.equal(3);
        ordinaryNames.should.deep.equal(['QueryHealth.ObserveHealth']);
    });
    it('should show the allowed caller connection after admission', () => {
        allowed.totalConnections.should.equal(0);
        ownHealth.totalConnections.should.equal(1);
    });
});
