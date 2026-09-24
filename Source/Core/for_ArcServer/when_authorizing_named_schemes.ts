// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, defineQuery } from '../index.js';

const principal = { id: 'alice', roles: [], isAuthenticated: true };
const authentication = (request: Request) => request.headers.get('authorization') === 'Bearer token'
    ? { status: AuthenticationStatus.Authenticated as const, principal }
    : { status: AuthenticationStatus.Anonymous as const };

describe('when selecting an authentication scheme for a query', () => {
    let selected: Response;
    let missing: Response;
    let denied: Response;
    beforeEach(async () => {
        const server = new ArcServer({ authenticationSchemes: { Verified: authentication },
            queries: [defineQuery({ name: 'Protected', schema: z.object({}),
                authorization: { authenticated: true, schemes: ['Verified'] },
                perform: (_input, context) => context.principal?.scheme })] });
        try {
            selected = (await server.handle(new Request('http://localhost/api/protected', { headers: { authorization: 'Bearer token' } })))!;
            missing = (await server.handle(new Request('http://localhost/api/protected')))!;
            denied = (await server.handle(new Request('http://localhost/api/protected', { headers: { authorization: 'Bearer invalid' } })))!;
        } finally { await server.dispose(); }
    });
    it('should select the named handler rather than the default handler', async () => {
        selected.status.should.equal(200);
        (await selected.json()).data.should.equal('Verified');
    });
    it('should challenge a missing principal', () => { missing.status.should.equal(401); });
    it('should challenge an unrecognized credential', () => { denied.status.should.equal(401); });
});

describe('when the selected scheme is unknown', () => {
    let error: unknown;
    beforeEach(() => {
        try { new ArcServer({ queries: [defineQuery({ name: 'Unknown', schema: z.object({}),
            authorization: { schemes: ['Unregistered'] }, perform: () => true })] }); }
        catch (failure) { error = failure; }
    });
    it('should fail at registration', () => { String(error).should.contain('Unknown authentication scheme'); });
});
