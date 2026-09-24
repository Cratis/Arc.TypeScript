// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { runtimePost } from '../given/a_runtime_request.js';

should();
describe('when validating a command with a provider and scope', () => {
    let status: number;
    const calls: string[] = [];
    beforeEach(async () => {
        calls.length = 0;
        const server = new ArcServer({ commands: [defineCommand({ name: 'Create', namespace: 'Tasks', schema: z.object({ title: z.string() }),
            validate: () => { calls.push('validate'); return []; }, provide: () => { calls.push('provide'); return 1; },
            handle: () => { calls.push('handle'); return 1; },
            scopes: [() => ({ begin: () => { calls.push('begin'); }, complete: () => { calls.push('complete'); } })]
        })] });
        status = (await server.handle(runtimePost('/api/tasks/create/validate', { title: 'hello' })))!.status;
        await server.dispose();
    });
    it('should return success', () => status.should.equal(200));
    it('should validate without providing, handling or beginning scopes', () => calls.should.deep.equal(['validate']));
});
