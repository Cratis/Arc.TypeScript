// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { Severity } from '../../validation/Severity.js';
import { validation } from '../../validation/ValidationResult.js';
import { runtimePost } from '../given/a_runtime_request.js';

should();
describe('when handling a command with denied authorization', () => {
    let status: number;
    const calls: string[] = [];
    beforeEach(async () => {
        calls.length = 0;
        const server = new ArcServer({ commands: [defineCommand({ name: 'Create', namespace: 'Tasks', schema: z.object({ title: z.string() }), authorization: { roles: ['writer'] },
            validate: () => { calls.push('validate'); return [validation('bad', ['title'], 'rule', Severity.Error)]; },
            provide: () => { calls.push('provide'); return 1; }, handle: () => { calls.push('handle'); return 1; },
            scopes: [() => ({ begin: () => { calls.push('begin'); }, complete: () => { calls.push('complete'); } })]
        })], authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal: { id: 'a', roles: ['reader'], isAuthenticated: true } })] });
        status = (await server.handle(runtimePost('/api/tasks/create', { title: 1 })))!.status;
        await server.dispose();
    });
    it('should return forbidden', () => status.should.equal(403));
    it('should not validate, provide, handle or begin scopes', () => calls.should.deep.equal([]));
});
