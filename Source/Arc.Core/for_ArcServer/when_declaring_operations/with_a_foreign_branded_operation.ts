// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { an_operation_command } from '../given/an_operation_command.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
describe('when another package copy declares a branded operation', given(an_operation_command, context => {
    let result: CommandResult;
    beforeEach(async () => {
        context.value = { [Symbol.for('@cratis/arc.core/CommandOperation')]: true,
            execute: (signal: AbortSignal) => { void signal; context.events.push('foreign execute'); } };
        result = await context.server.executeCommand('Run', context.command, context.context);
    });
    it('should execute it instead of returning it to the client', () => {
        result.isSuccess.should.equal(true);
        context.events.should.deep.equal(['begin', 'foreign execute', 'complete']);
        (result.response === undefined).should.equal(true);
    });
}));
