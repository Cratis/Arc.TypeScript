// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { constraint, concurrency } from '../../for_ChronicleCommand/given/a_command_with_typed_ports.js';
import { a_registered_command, context } from '../given/a_registered_command.js';

describe('when Chronicle rejects a returned event at commit', given(a_registered_command, setup => {
    it('should report a constraint violation as validation rather than success', async () => {
        setup.appendMany.resolves([constraint()]);
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('Create', { id: 'source-1', name: 'Ada' }, context());
            result.isSuccess.should.equal(false);
            result.validationResults[0]!.reason.should.equal('constraintViolation');
        } finally { await app.dispose(); }
    });
    it('should report a concurrency violation as validation rather than success', async () => {
        setup.appendMany.resolves([concurrency()]);
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('Create', { id: 'source-1', name: 'Ada' }, context());
            result.isSuccess.should.equal(false);
            result.validationResults[0]!.reason.should.equal('concurrencyViolation');
        } finally { await app.dispose(); }
    });
}));
