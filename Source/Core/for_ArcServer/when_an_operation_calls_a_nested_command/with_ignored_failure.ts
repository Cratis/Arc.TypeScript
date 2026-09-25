// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { an_operation_command } from '../given/an_operation_command.js';
import { CommandOperation } from '../../commands/CommandOperation.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
describe('when an operation calls a nested command with ignored failure', given(an_operation_command, context => {
    let result: CommandResult;
    beforeEach(async () => {
        class Nested extends CommandOperation {
            async execute(signal: AbortSignal): Promise<void> {
                void signal;
                await context.server.executeCommand('Run', { key: 'nested' }, context.context);
            }
            compensate(failure: unknown, signal: AbortSignal): void { void failure; void signal; context.events.push('compensate'); }
        }
        context.value = new Nested();
        result = await context.server.executeCommand('Run', context.command, context.context);
    });
    it('should reject the outer operation and attempt compensation', () => {
        result.isSuccess.should.equal(false);
        context.events.should.deep.equal(['begin', 'complete', 'compensate']);
    });
}));
