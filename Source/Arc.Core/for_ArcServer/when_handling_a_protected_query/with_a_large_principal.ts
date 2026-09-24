// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { defineQuery } from '../../queries/defineQuery.js';
import type { Principal } from '../../identity/Principal.js';

should();

describe('when handling a protected query with a large principal', () => {
    let server: ArcServer;
    let response: Response | null;
    let body: { data: string };
    let received: Principal[];

    beforeEach(async () => {
        const roles = Array.from({ length: 80 }, (_, index) => `group-${index}`);
        roles.push('Reader', '');
        received = [];
        server = new ArcServer({
            authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal: {
                id: '', name: '', isAuthenticated: true, roles, department: 'research', claims: { note: 'x'.repeat(1024) }
            } })],
            queries: [defineQuery({ name: 'Protected', schema: z.object({}), authorization: { roles: ['Reader'] },
                perform: (_input, context) => { received.push(context.principal!); return context.principal?.id; } })]
        });
        response = await server.handle(new Request('http://localhost/api/protected'));
        body = await response!.json();
    });
    afterEach(async () => server.dispose());

    it('should authorize the query', () => response!.status.should.equal(200));
    it('should preserve the empty identity id', () => body.data.should.equal(''));
    it('should invoke the query once', () => received.should.have.lengthOf(1));
    it('should preserve all roles', () => received[0]!.roles.should.have.lengthOf(82));
    it('should preserve additional principal fields', () => (received[0] as Principal & { department: string }).department.should.equal('research'));
    it('should preserve the empty display name', () => received[0]!.name!.should.equal(''));
});
