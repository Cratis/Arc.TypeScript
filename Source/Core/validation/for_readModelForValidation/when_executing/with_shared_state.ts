// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from '../../../commands/CommandResult.js';
import { a_command_with_validation_state, executionContext, State } from '../given/a_command_with_validation_state.js';

describe('when executing with shared validation preparation and handler state', () => {
    let context: a_command_with_validation_state;
    let result: CommandResult;
    let state: State;
    beforeEach(async () => {
        context = new a_command_with_validation_state();
        state = new State();
        context.resolver.lookup.resolves(state);
        const application = await context.builder.build();
        try {
            result = await application.server.executeCommand('ChangeState', { id: 'state-1', name: 'new' }, executionContext());
        } finally { await application.dispose(); }
    });
    it('should execute successfully with identical preparation and handler arguments', () => {
        result.isSuccess.should.equal(true);
        result.response!.should.equal(true);
    });
    it('should resolve state only once', () => { context.resolver.lookup.calledOnce.should.equal(true); });
    it('should share the exact instance across validation preparation and the handler', () => {
        context.probe.validated.should.have.lengthOf(1);
        context.probe.prepared.should.have.lengthOf(1);
        context.probe.handled.should.have.lengthOf(1);
        context.probe.validated[0]!.should.equal(state);
        context.probe.prepared[0]!.should.equal(state);
        context.probe.handled[0]!.should.equal(state);
    });
});
