// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, defineCommand, defineQuery } from '../../index.js';
import type { AuthenticationHandler, Principal } from '../../index.js';
import { authenticate } from '../../authentication/authenticate.js';

should();

const invalidResults: readonly unknown[] = [
    { status: 'unknown' },
    { status: AuthenticationStatus.Authenticated, principal: { id: 'user', isAuthenticated: 'false', roles: ['Admin'] } },
    { status: AuthenticationStatus.Authenticated, principal: { id: 'user', isAuthenticated: true, roles: 'Admin' } },
    { status: AuthenticationStatus.Authenticated, principal: { id: 'user', isAuthenticated: true, roles: ['Admin', 1] } },
    { status: AuthenticationStatus.Authenticated, principal: { isAuthenticated: true, roles: ['Admin'] } }
];

describe('compatible verified principals', () => {
    it('authorizes a protected role beyond 64 roles and preserves long and empty identity fields', async () => {
        const roles = Array.from({ length: 80 }, (_, index) => `group-${index}`);
        roles.push('Reader', '');
        const received: Principal[] = [];
        const server = new ArcServer({
            authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal: {
                id: '', name: '', isAuthenticated: true, roles, department: 'research', claims: { note: 'x'.repeat(1024) }
            } })],
            queries: [defineQuery({ name: 'Protected', schema: z.object({}), authorization: { roles: ['Reader'] },
                perform: (_input, context) => { received.push(context.principal!); return context.principal?.id; } })]
        });
        const response = (await server.handle(new Request('http://localhost/api/protected')))!;
        response.status.should.equal(200);
        (await response.json()).data.should.equal('');
        received.should.have.length(1);
        received[0]!.roles.should.have.length(82);
        (received[0] as Principal & { department: string }).department.should.equal('research');
        received[0]!.name!.should.equal('');
        await server.dispose();
    });
    it('copies and freezes role and own claim dictionaries without dropping extensions', async () => {
        const roles = ['Reader', ''];
        const claims = { membership: 'north,'.repeat(100), unused: '\u0000'.repeat(300) };
        const extension = { raw: true };
        const original = { id: 'a'.repeat(400), name: '\u0000', isAuthenticated: true, roles, claims, extension };
        const verified = (await authenticate(new Request('http://localhost/'), [() => ({ status: AuthenticationStatus.Authenticated, principal: original })])).principal!;
        verified.id.should.equal(original.id);
        verified.roles.should.deep.equal(['Reader', '']);
        should().equal((verified.claims as Record<string, unknown>).membership, claims.membership);
        (verified as Principal & { extension: typeof extension }).extension.should.equal(extension);
        Object.isFrozen(verified).should.equal(true);
        Object.isFrozen(verified.roles).should.equal(true);
        Object.isFrozen(verified.claims).should.equal(true);
        roles.push('Admin');
        claims.membership = 'south';
        verified.roles.should.deep.equal(['Reader', '']);
        should().equal((verified.claims as Record<string, unknown>).membership, 'north,'.repeat(100));
    });
    it('does not reject legacy extra fields named claims when they are not claim dictionaries', async () => {
        for (const extra of [[{ type: 'department', value: 'research' }], 'opaque', 42, null]) {
            const original = { id: '', isAuthenticated: true, roles: [''], claims: extra };
            const verified = (await authenticate(new Request('http://localhost/'), [() => ({ status: AuthenticationStatus.Authenticated,
                principal: original })])).principal!;
            (verified.claims === extra).should.equal(true);
        }
    });
    it('does not trust inherited claims even when a principal is authenticated', async () => {
        const original = Object.assign(Object.create({ claims: { tenant: 'north' } }) as Principal,
            { id: 'user', isAuthenticated: true, roles: ['Reader'] });
        const verified = (await authenticate(new Request('http://localhost/'), [() => ({ status: AuthenticationStatus.Authenticated, principal: original })])).principal!;
        Object.hasOwn(verified, 'claims').should.equal(false);
    });
});

describe('when an authentication handler violates its runtime contract', () => {
    for (const [index, result] of invalidResults.entries()) {
        it(`should fail closed without invoking a fallback handler for invalid result ${index}`, async () => {
            let fallbackCalls = 0;
            let executions = 0;
            const command = defineCommand({
                name: 'Protected', schema: z.object({}), authorization: { roles: ['Admin', 'A'] },
                handle: () => { executions++; }
            });
            const server = new ArcServer({
                commands: [command],
                authentication: [
                    (() => result) as AuthenticationHandler,
                    () => {
                        fallbackCalls++;
                        return { status: AuthenticationStatus.Authenticated, principal: { id: 'user', isAuthenticated: true, roles: ['Admin'] } };
                    }
                ]
            });
            const response = await server.handle(new Request('http://localhost/api/protected', { method: 'POST', body: '{}' }));
            response!.status.should.equal(500);
            fallbackCalls.should.equal(0);
            executions.should.equal(0);
            (await response!.text()).should.not.contain('Authentication handler returned');
        });
    }
});
