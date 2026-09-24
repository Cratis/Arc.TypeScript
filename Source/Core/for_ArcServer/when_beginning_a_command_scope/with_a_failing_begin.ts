// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { runtimePost } from '../given/a_runtime_request.js';

should();
describe('when beginning a command scope with a failing begin', () => {
    let body: { response?: unknown; hasExceptions: boolean };
    const calls: string[] = [];
    beforeEach(async () => {
        calls.length = 0;
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () => { calls.push('handle'); return 'secret'; }, scopes: [
            () => ({ begin: () => { calls.push('first'); }, complete: () => { calls.push('complete first'); } }),
            () => ({ begin: () => { calls.push('second'); throw Error('begin'); }, complete: () => { calls.push('complete second'); throw Error('complete'); } })
        ] })] });
        body = await (await server.handle(runtimePost('/api/save', {})))!.json();
        await server.dispose();
    });
    it('should clear the response and report the failure', () => {
        (body.response === undefined).should.equal(true);
        body.hasExceptions.should.equal(true);
    });
    it('should complete partly begun scopes once in reverse order', () => calls.should.deep.equal(['first', 'second', 'complete second', 'complete first']));
});
