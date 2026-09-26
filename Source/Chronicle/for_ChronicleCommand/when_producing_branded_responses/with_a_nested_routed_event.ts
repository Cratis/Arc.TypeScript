// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { eventForEventSourceId } from '../../eventForEventSourceId.js';
import { a_command_with_typed_ports, accepted, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

should();
describe('when a nested array contains a routed event as a Chronicle client response', given(a_command_with_typed_ports, context => {
    let success: boolean;
    let errors: string[];
    beforeEach(async () => {
        const routed = eventForEventSourceId({ eventSourceId: 'other', event: new Placed('unappended') });
        const { server } = context.setup(async () => [accepted()], undefined, [Placed], [[routed]]);
        try {
            const result = await server.executeCommand('Place', {}, executionContext('a'));
            success = result.isSuccess;
            errors = result.exceptionMessages;
        } finally { await server.dispose(); }
    });
    it('should reject the routed event', () => {
        success.should.equal(false);
        errors.should.deep.equal(['Error: A Chronicle command cannot return an event or command operation as its client response']);
    });
}));
