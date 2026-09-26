// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_command_with_typed_ports, accepted, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

should();
describe('when a cyclic array contains an event as a Chronicle client response', given(a_command_with_typed_ports, context => {
    let success: boolean;
    let returned: unknown;
    let errors: string[];
    beforeEach(async () => {
        const cyclic: unknown[] = [];
        cyclic.push(cyclic, [new Placed('unappended')]);
        const { server } = context.setup(async () => [accepted()], undefined, [Placed], cyclic);
        try {
            const result = await server.executeCommand('Place', {}, executionContext('a'));
            success = result.isSuccess;
            returned = result.response;
            errors = result.exceptionMessages;
        } finally { await server.dispose(); }
    });
    it('should terminate and reject the nested event', () => {
        success.should.equal(false);
        (returned === undefined).should.equal(true);
        errors.should.deep.equal(['Error: A Chronicle command cannot return an event or command operation as its client response']);
    });
}));
