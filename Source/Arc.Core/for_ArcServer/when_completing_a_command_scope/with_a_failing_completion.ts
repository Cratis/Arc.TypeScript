// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { runtimePost } from '../given/a_runtime_request.js';

should();
describe('when completing a command scope with a failing completion', () => {
    let status: number;
    let body: { isSuccess: boolean; response?: unknown; exceptionMessages: string[] };
    const logged: unknown[] = [];
    const order: string[] = [];
    beforeEach(async () => {
        logged.length = 0;
        order.length = 0;
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () => 'secret response', scopes: [
            () => ({ begin: () => { order.push('first'); }, complete: () => { order.push('last'); } }),
            () => ({ begin: () => { order.push('second'); }, complete: () => { order.push('reverse'); throw new Error('sensitive error'); } })
        ] })], logger: error => { logged.push(error); } });
        const response = (await server.handle(runtimePost('/api/save', {})))!;
        status = response.status;
        body = await response.json();
        await server.dispose();
    });
    it('should report server failure', () => status.should.equal(500));
    it('should clear the successful response', () => {
        body.isSuccess.should.equal(false);
        (body.response === undefined).should.equal(true);
    });
    it('should redact the exception from the wire response', () => body.exceptionMessages.should.deep.equal(['An unexpected error occurred']));
    it('should log the original exception', () => {
        (logged[0] instanceof Error).should.equal(true);
        (logged[0] as Error).message.should.equal('sensitive error');
    });
    it('should complete the scopes in reverse order', () => order.should.deep.equal(['first', 'second', 'reverse', 'last']));
});
