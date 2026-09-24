// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { an_operation_command } from '../given/an_operation_command.js';
import { CommandOperation } from '../../commands/CommandOperationDeclaration.js';
import type { CommandOperationFailure } from '../../commands/CommandOperationFailure.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
describe('when an execution failure precedes a scope completion failure', given(an_operation_command, context => {
    let result: CommandResult;
    let source: string | undefined;
    beforeEach(async () => {
        class Failing extends CommandOperation {
            execute(signal: AbortSignal): void { void signal; throw new Error('execution failed'); }
            compensate(failure: CommandOperationFailure, signal: AbortSignal): void { void signal; source = failure.source; }
        }
        context.failCompletion = true;
        context.value = new Failing();
        result = await context.server.executeCommand('Run', context.command, context.context);
    });
    it('should preserve execution as the source of the first failure', () => {
        source!.should.equal('execution');
        result.isSuccess.should.equal(false);
    });
}));
