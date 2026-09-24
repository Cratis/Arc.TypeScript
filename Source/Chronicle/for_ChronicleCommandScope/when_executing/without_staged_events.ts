// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, CommandOperation, command } from '@cratis/arc.core';
import { a_registered_command, context } from '../../for_ChronicleResponseHandler/given/a_registered_command.js';

let executed = false;
class StandaloneOperation extends CommandOperation {
    execute(signal: AbortSignal): void { signal.throwIfAborted(); executed = true; }
    compensate(_failure: unknown, signal: AbortSignal): void { signal.throwIfAborted(); }
}
@command() class OperationOnly { handle() { return new StandaloneOperation(); } }

describe('when a command has no staged Chronicle events', () => {
    it('should allow another deferred commit participant and report no Chronicle commit', async () => {
        const setup = new a_registered_command();
        const builder = ArcApplication.createBuilder();
        builder.addChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
        builder.addCommandExecutionScope(() => ({ isCommitParticipant: true, getCommitDisposition: () => 'NoCommit' as const,
            begin() {}, complete() {} }));
        builder.add(OperationOnly);
        const app = await builder.build();
        try {
            executed = false;
            const result = await app.server.executeCommand('OperationOnly', {}, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            executed.should.equal(true);
            setup.appendMany.called.should.equal(false);
        } finally { await app.dispose(); }
    });
});
