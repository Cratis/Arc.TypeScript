// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { CommandOperation, tuple } from '@cratis/arc.core';
import { given } from '../../given.js';
import { a_command_with_typed_ports, accepted, executionContext } from '../given/a_command_with_typed_ports.js';

class UnexpectedOperation extends CommandOperation {
    execute(): void { throw new Error('Operation must not execute'); }
}

should();
describe('when a tuple contains an operation as a Chronicle client response', given(a_command_with_typed_ports, context => {
    let success: boolean;
    let response: unknown;
    let errors: string[];
    beforeEach(async () => {
        const { server } = context.setup(async () => [accepted()], undefined, undefined, tuple(new UnexpectedOperation()));
        try {
            const result = await server.executeCommand('Place', {}, executionContext('a'));
            success = result.isSuccess;
            response = result.response;
            errors = result.exceptionMessages;
        } finally { await server.dispose(); }
    });
    it('should reject the operation rather than execute it', () => {
        success.should.equal(false);
        (response === undefined).should.equal(true);
        errors.should.deep.equal(['Error: A Chronicle command cannot return an event or command operation as its client response']);
    });
}));
