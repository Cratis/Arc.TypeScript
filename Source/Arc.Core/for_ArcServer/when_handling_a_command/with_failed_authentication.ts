// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { runtimePost } from '../given/a_runtime_request.js';

should();
describe('when handling a command with failed authentication', () => {
    let status: number;
    let response: { response?: unknown };
    const calls: string[] = [];
    beforeEach(async () => {
        calls.length = 0;
        const server = new ArcServer({ commands: [defineCommand({ name: 'Create', schema: z.object({}), authorization: { authenticated: true }, handle: () => { calls.push('handle'); return 'secret'; } })], authentication: [
            () => { calls.push('first'); return { status: AuthenticationStatus.Anonymous }; },
            () => { calls.push('failed'); return { status: AuthenticationStatus.Failed }; },
            () => { calls.push('later'); return { status: AuthenticationStatus.Authenticated, principal: { id: 'id', roles: [], isAuthenticated: true } }; }
        ] });
        const result = (await server.handle(runtimePost('/api/create', {})))!;
        status = result.status;
        response = await result.json();
        await server.dispose();
    });
    it('should fail closed with unauthorized status', () => status.should.equal(401));
    it('should stop authentication at the failed handler', () => calls.should.deep.equal(['first', 'failed']));
    it('should withhold the response', () => (response.response === undefined).should.equal(true));
});
