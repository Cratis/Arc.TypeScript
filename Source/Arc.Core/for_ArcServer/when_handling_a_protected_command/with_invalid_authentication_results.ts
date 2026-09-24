// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import sinon from 'sinon';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import type { AuthenticationHandler } from '../../authentication/AuthenticationHandler.js';
import { defineCommand } from '../../commands/defineCommand.js';

should();

const invalidResults: readonly unknown[] = [
    { status: 'unknown' },
    { status: AuthenticationStatus.Authenticated, principal: { id: 'user', isAuthenticated: 'false', roles: ['Admin'] } },
    { status: AuthenticationStatus.Authenticated, principal: { id: 'user', isAuthenticated: true, roles: 'Admin' } },
    { status: AuthenticationStatus.Authenticated, principal: { id: 'user', isAuthenticated: true, roles: ['Admin', 1] } },
    { status: AuthenticationStatus.Authenticated, principal: { isAuthenticated: true, roles: ['Admin'] } }
];

describe('when handling a protected command with invalid authentication results', () => {
    let statuses: number[];
    let fallbackCalls: number[];
    let handlerCalls: number[];
    let bodies: string[];

    beforeEach(async () => {
        statuses = [];
        fallbackCalls = [];
        handlerCalls = [];
        bodies = [];
        for (const result of invalidResults) {
            const fallback = sinon.stub().returns({ status: AuthenticationStatus.Authenticated,
                principal: { id: 'user', isAuthenticated: true, roles: ['Admin'] } });
            const handle = sinon.stub();
            const server = new ArcServer({
                commands: [defineCommand({ name: 'Protected', schema: z.object({}), authorization: { roles: ['Admin', 'A'] }, handle })],
                authentication: [(() => result) as AuthenticationHandler, fallback]
            });
            try {
                const response = (await server.handle(new Request('http://localhost/api/protected', { method: 'POST', body: '{}' })))!;
                statuses.push(response.status);
                bodies.push(await response.text());
                fallbackCalls.push(fallback.callCount);
                handlerCalls.push(handle.callCount);
            } finally { await server.dispose(); }
        }
    });

    it('should fail closed for every invalid result', () => statuses.should.deep.equal([500, 500, 500, 500, 500]));
    it('should never invoke a fallback handler', () => fallbackCalls.should.deep.equal([0, 0, 0, 0, 0]));
    it('should never execute the command', () => handlerCalls.should.deep.equal([0, 0, 0, 0, 0]));
    it('should redact authentication contract details', () => bodies.map(body => body.includes('Authentication handler returned')).should.deep.equal([false, false, false, false, false]));
});
