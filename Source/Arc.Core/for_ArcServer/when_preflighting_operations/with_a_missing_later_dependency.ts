// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { an_operation_command, ProbeOperation } from '../given/an_operation_command.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { tuple } from '../../results/tuple.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
describe('when preflighting operations with a missing later dependency', given(an_operation_command, context => {
    let result: CommandResult;
    beforeEach(async () => {
        const missing = serviceToken<object>('missing operation service');
        const first = new ProbeOperation('first', context.events);
        const second = new ProbeOperation('second', context.events);
        Object.assign(second, { executeDependencies: [missing], execute: (signal: AbortSignal, service: unknown) => { void signal; void service; } });
        context.value = tuple(first, second);
        result = await context.server.executeCommand('Run', context.command, context.context);
    });
    it('should fail before entering any operation', () => {
        context.events.should.deep.equal(['begin', 'complete']);
        result.isSuccess.should.equal(false);
        (result.recovery === undefined).should.equal(true);
    });
}));
