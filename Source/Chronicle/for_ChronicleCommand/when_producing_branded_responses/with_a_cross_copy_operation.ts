// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_command_with_typed_ports, accepted, executionContext } from '../given/a_command_with_typed_ports.js';

should();
describe('when a Chronicle client response is a branded operation from another copy', given(a_command_with_typed_ports, context => {
    let success: boolean;
    let response: unknown;
    let errors: string[];
    beforeEach(async () => {
        const operation = { [Symbol.for('@cratis/arc.core/CommandOperation')]: true,
            execute: () => { throw new Error('Operation must not execute'); } };
        const { server } = context.setup(async () => [accepted()], undefined, undefined, operation);
        try {
            const result = await server.executeCommand('Place', {}, executionContext('a'));
            success = result.isSuccess;
            response = result.response;
            errors = result.exceptionMessages;
        } finally { await server.dispose(); }
    });
    it('should reject the branded operation instead of returning or executing it', () => {
        success.should.equal(false);
        (response === undefined).should.equal(true);
        errors.should.deep.equal(['Error: A Chronicle command cannot return an event or command operation as its client response']);
    });
}));
