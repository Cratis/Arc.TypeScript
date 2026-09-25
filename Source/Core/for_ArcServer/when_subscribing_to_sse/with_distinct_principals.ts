// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();

describe('when subscribing to SSE with distinct principals', () => {
    let aliceAgain: number | undefined;
    let bobStatus: number | undefined;

    beforeEach(async () => {
        const server = new ArcServer({ query: { maxObservableSubscriptionsPerCaller: 1 },
            authentication: [request => ({ status: AuthenticationStatus.Authenticated,
                principal: { id: request.headers.get('authorization') ?? '', roles: [], isAuthenticated: true } })],
            observableQueries: [defineObservableQuery({ name: 'Value', schema: z.object({}),
                observe: () => new CurrentValueSubject<number>(1) })] });
        const request = (id: string): Request => new Request('http://localhost/api/value', {
            headers: { accept: 'text/event-stream', authorization: id }
        });
        const alice = await server.handle(request('alice'));
        aliceAgain = (await server.handle(request('alice')))?.status;
        const bob = await server.handle(request('bob'));
        bobStatus = bob?.status;
        await alice?.body?.cancel();
        await bob?.body?.cancel();
        await server.dispose();
    });

    it('should limit a second subscription by one principal', () => { aliceAgain?.should.equal(503); });
    it('should allow a different principal', () => { bobStatus?.should.equal(200); });
});
