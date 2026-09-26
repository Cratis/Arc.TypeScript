// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_command_with_typed_ports, accepted, executionContext } from '../given/a_command_with_typed_ports.js';

should();
describe('when an array contains operations branded by another copy of Core', given(a_command_with_typed_ports, context => {
    let success: boolean;
    let errors: string[];
    beforeEach(async () => {
        const batch = { [Symbol.for('@cratis/arc.core/command-operations')]: true, values: [] };
        const { server } = context.setup(async () => [accepted()], undefined, undefined, [[batch]]);
        try {
            const result = await server.executeCommand('Place', {}, executionContext('a'));
            success = result.isSuccess;
            errors = result.exceptionMessages;
        } finally { await server.dispose(); }
    });
    it('should reject the nested operation batch', () => {
        success.should.equal(false);
        errors.should.deep.equal(['Error: A Chronicle command cannot return an event or command operation as its client response']);
    });
}));
