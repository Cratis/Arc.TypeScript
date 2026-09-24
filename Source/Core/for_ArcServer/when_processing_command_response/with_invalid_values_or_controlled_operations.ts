// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { an_operation_command, ProbeOperation } from '../given/an_operation_command.js';
import { denied, rejected } from '../../results/index.js';
import { tuple } from '../../results/tuple.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
for (const [name, value] of [
    ['denied', denied('no')],
    ['rejected', rejected({ severity: 3, message: 'blocked', members: [], reason: 'blocked' })]
] as const) {
    describe(`when ${name} controls a tuple with operations`, given(an_operation_command, context => {
        let result: CommandResult;
        beforeEach(async () => {
            context.value = tuple(value, new ProbeOperation('effect', context.events));
            result = await context.server.executeCommand('Run', context.command, context.context);
        });
        it('should not execute operations', () => {
            result.isSuccess.should.equal(false);
            context.events.should.deep.equal(['begin', 'complete']);
        });
    }));
}
describe('when a command returns two unhandled values', given(an_operation_command, context => {
    let result: CommandResult;
    beforeEach(async () => {
        context.value = tuple('first', 'second');
        result = await context.server.executeCommand('Run', context.command, context.context);
    });
    it('should reject the ambiguous response', () => {
        result.isSuccess.should.equal(false);
        context.events.should.deep.equal(['begin', 'complete']);
    });
}));
describe('when a command returns a plain array of operations', given(an_operation_command, context => {
    let result: CommandResult;
    beforeEach(async () => {
        context.value = [new ProbeOperation('effect', context.events)];
        result = await context.server.executeCommand('Run', context.command, context.context);
    });
    it('should reject the array before an effect begins', () => {
        result.isSuccess.should.equal(false);
        context.events.should.deep.equal(['begin', 'complete']);
    });
}));
