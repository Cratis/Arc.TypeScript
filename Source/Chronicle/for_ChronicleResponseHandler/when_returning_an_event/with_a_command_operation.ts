// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_registered_command, context, operationExecuted, operationCompensated } from '../given/a_registered_command.js';
import { constraint } from '../../for_ChronicleCommand/given/a_command_with_typed_ports.js';

describe('when returning an event and a command operation', given(a_registered_command, setup => {
    it('should execute the operation and commit the event on success', async () => {
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('CreateWithOperation', { id: 'task-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            operationExecuted.should.equal(true);
            operationCompensated.should.equal(false);
            setup.appendMany.calledOnce.should.equal(true);
        } finally { await app.dispose(); }
    });
    it('should suppress compensation when the append outcome is unknown', async () => {
        setup.appendMany.resolves([]);
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('CreateWithOperation', { id: 'task-1' }, context());
            result.isSuccess.should.equal(false);
            operationExecuted.should.equal(true);
            operationCompensated.should.equal(false);
            result.recovery?.commitDisposition.should.equal('Unknown');
        } finally { await app.dispose(); }
    });
    it('should compensate the operation when Chronicle rejects the append', async () => {
        setup.appendMany.resolves([constraint()]);
        const app = await setup.build();
        try {
            const result = await app.server.executeCommand('CreateWithOperation', { id: 'task-1' }, context());
            result.isSuccess.should.equal(false);
            operationExecuted.should.equal(true);
            operationCompensated.should.equal(true);
            result.recovery?.commitDisposition.should.equal('NotCommitted');
        } finally { await app.dispose(); }
    });
}));
