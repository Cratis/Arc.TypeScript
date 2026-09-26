// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_command_with_typed_ports, accepted, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

should();
describe('when a plain client data object contains an event property', given(a_command_with_typed_ports, context => {
    let success: boolean;
    let returned: unknown;
    const clientData = { record: new Placed('client data') };
    beforeEach(async () => {
        const { server } = context.setup(async () => [accepted()], undefined, [Placed], clientData);
        try {
            const result = await server.executeCommand('Place', {}, executionContext('a'));
            success = result.isSuccess;
            returned = result.response;
        } finally { await server.dispose(); }
    });
    it('should allow ordinary object properties as client data', () => {
        success.should.equal(true);
        (returned === clientData).should.equal(true);
    });
}));
