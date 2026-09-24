// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, defineCommand } from '../src/index.js';
import type { AuthenticationHandler } from '../src/index.js';

should();

const invalidResults: readonly unknown[] = [
    { status: 'unknown' },
    { status: AuthenticationStatus.Authenticated, principal: { id: 'user', isAuthenticated: 'false', roles: ['Admin'] } },
    { status: AuthenticationStatus.Authenticated, principal: { id: 'user', isAuthenticated: true, roles: 'Admin' } },
    { status: AuthenticationStatus.Authenticated, principal: { id: 'user', isAuthenticated: true, roles: ['Admin', 1] } },
    { status: AuthenticationStatus.Authenticated, principal: { isAuthenticated: true, roles: ['Admin'] } }
];

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
