// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext } from '../../../commands/CommandContext.js';
import type { CommandResult } from '../../../commands/CommandResult.js';
import { a_command_with_validation_state, executionContext, State } from '../given/a_command_with_validation_state.js';

describe('when executing concurrent commands in two tenants', () => {
    let context: a_command_with_validation_state;
    let results: CommandResult[];
    let states: State[];
    let lookups: CommandContext[];
    beforeEach(async () => {
        context = new a_command_with_validation_state();
        states = []; lookups = [];
        let release!: () => void;
        const overlapping = new Promise<void>(resolve => { release = resolve; });
        context.resolver.lookup.callsFake(async (_type: unknown, _key: string, command: CommandContext) => {
            const state = new State(`${command.tenantId}/${command.correlationId}`);
            states.push(state); lookups.push(command);
            if (lookups.length === 4) release();
            await overlapping;
            return state;
        });
        const application = await context.builder.build();
        try {
            results = await Promise.all(['tenant-a', 'tenant-b'].flatMap(tenant => [1, 2].map(index =>
                application.server.executeCommand('ChangeState', { id: 'same-key', name: 'new' },
                    executionContext(tenant, `${tenant}-${index}`)))));
        } finally { await application.dispose(); }
    });
    it('should allow every overlapping command to complete with its own state', () => {
        results.map(result => [result.isSuccess, result.response]).should.deep.equal([[true, true], [true, true], [true, true], [true, true]]);
    });
    it('should load separately even for the same key and tenant', () => {
        context.resolver.lookup.callCount.should.equal(4);
        new Set(lookups).size.should.equal(4);
        lookups.map(command => [command.key, command.tenantId, command.correlationId]).should.have.deep.members([
            ['same-key', 'tenant-a', 'tenant-a-1'], ['same-key', 'tenant-a', 'tenant-a-2'],
            ['same-key', 'tenant-b', 'tenant-b-1'], ['same-key', 'tenant-b', 'tenant-b-2']
        ]);
    });
    it('should never reuse another commands cached instance in any phase', () => {
        for (const phase of [context.probe.validated, context.probe.prepared, context.probe.handled]) {
            phase.should.have.lengthOf(4);
            new Set(phase).size.should.equal(4);
            states.forEach(state => phase.filter(value => value === state).should.have.lengthOf(1));
        }
    });
});
