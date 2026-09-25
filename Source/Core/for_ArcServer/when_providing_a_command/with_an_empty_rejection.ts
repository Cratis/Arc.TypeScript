// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { rejected } from '../../commands/Outcome.js';
import { runtimePost } from '../given/a_runtime_request.js';

should();
describe('when providing a command with an empty rejection', () => {
    let status: number;
    let handled: boolean;
    let emptyError: unknown;
    beforeEach(async () => {
        handled = false;
        try { rejected(); } catch (error) { emptyError = error; }
        const server = new ArcServer({ commands: [defineCommand({ name: 'Empty', schema: z.object({}), provide: () => rejected(), handle: () => { handled = true; return 1; } })] });
        status = (await server.handle(runtimePost('/api/empty', {})))!.status;
        await server.dispose();
    });
    it('should reject an empty rejection outcome', () => (emptyError instanceof Error).should.equal(true));
    it('should return a server failure for an empty provider rejection', () => status.should.equal(500));
    it('should not run the handler', () => handled.should.equal(false));
});
