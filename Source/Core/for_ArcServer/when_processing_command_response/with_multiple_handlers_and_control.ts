// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { tuple } from '../../commands/tuple.js';
import { denied, rejected, response } from '../../results/index.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import type { CommandResponseValueHandler } from '../../commands/CommandResponseValueHandler.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
const execution = { correlationId: 'handlers', allowedSeverity: 2, principal: undefined, tenantId: undefined,
    signal: new AbortController().signal };
const first = serviceToken<CommandResponseValueHandler>('A first');
const second = serviceToken<CommandResponseValueHandler>('B second');
function server(value: unknown, calls: string[], outcome: unknown = undefined, reverse = false): ArcServer {
    const handlers = [first, second];
    return new ArcServer({
        services: [
            { token: first, lifetime: 'scoped', factory: () => ({ canHandle: (_: CommandContext, item: unknown) => item === 'effect',
                handle: () => { calls.push('first'); return outcome as never; } }) },
            { token: second, lifetime: 'scoped', factory: () => ({ canHandle: (_: CommandContext, item: unknown) => item === 'effect',
                handle: () => { calls.push('second'); } }) }
        ],
        commandResponseValueHandlers: reverse ? handlers.reverse() : handlers,
        commands: [defineCommand({ name: 'Run', schema: z.object({}), handle: () => value })]
    });
}
describe('when multiple handlers match independent of registration order', () => {
    let calls: string[];
    let result: CommandResult;
    beforeEach(async () => {
        calls = [];
        result = await server(tuple('reply', 'effect'), calls, undefined, true).executeCommand('Run', {}, execution);
    });
    it('should run every handler in stable name order', () => {
        calls.should.deep.equal(['first', 'second']);
        (result.response as string).should.equal('reply');
    });
});
for (const [name, outcome] of [['denied', denied('no')], ['rejected', rejected({ severity: 3, message: 'blocked', members: [], reason: 'blocked' })], ['response', response('other')]] as const) {
    describe(`when a handler returns ${name}`, () => {
        let calls: string[];
        let result: CommandResult;
        beforeEach(async () => {
            calls = [];
            result = await server(tuple('reply', 'effect'), calls, outcome).executeCommand('Run', {}, execution);
        });
        it('should stop later handlers after a failure', () => {
            result.isSuccess.should.equal(false);
            calls.should.deep.equal(['first']);
        });
    });
}
describe('when a non-operation tuple contains control and handler values', () => {
    let calls: string[];
    let result: CommandResult;
    beforeEach(async () => {
        calls = [];
        result = await server(tuple(denied('no'), 'effect'), calls).executeCommand('Run', {}, execution);
    });
    it('should run handlers even though the command is denied', () => {
        result.isSuccess.should.equal(false);
        calls.should.deep.equal(['first', 'second']);
    });
});
