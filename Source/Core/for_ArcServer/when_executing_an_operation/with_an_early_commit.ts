// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandCommitDisposition } from '../../commands/CommandCommitDisposition.js';
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { an_operation_command, ProbeOperation } from '../given/an_operation_command.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
for (const disposition of [CommandCommitDisposition.Committed, CommandCommitDisposition.Unknown, CommandCommitDisposition.Mixed] as const) {
    describe(`when an operation is declared after ${disposition}`, given(an_operation_command, context => {
        let result: CommandResult;
        beforeEach(async () => {
            context.disposition = disposition;
            context.value = new ProbeOperation('first', context.events);
            result = await context.server.executeCommand('Run', context.command, context.context);
        });
        it('should refuse to start the operation', () => {
            context.events.should.deep.equal(['begin', 'complete']);
            result.isSuccess.should.equal(false);
            result.recovery!.startedCount.should.equal(0);
        });
    }));
}
