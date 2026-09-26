// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_command_with_typed_ports, accepted, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

should();
describe('when deeply nested arrays contain an event as a Chronicle client response', given(a_command_with_typed_ports, context => {
    let success: boolean;
    let returned: unknown;
    let errors: string[];
    beforeEach(async () => {
        const { server } = context.setup(async () => [accepted()], undefined, [Placed], ['client', [[['data', new Placed('unappended')]]]]);
        try {
            const result = await server.executeCommand('Place', {}, executionContext('a'));
            success = result.isSuccess;
            returned = result.response;
            errors = result.exceptionMessages;
        } finally { await server.dispose(); }
    });
    it('should reject the deeply nested event', () => {
        success.should.equal(false);
        (returned === undefined).should.equal(true);
        errors.should.deep.equal(['Error: A Chronicle command cannot return an event or command operation as its client response']);
    });
}));
