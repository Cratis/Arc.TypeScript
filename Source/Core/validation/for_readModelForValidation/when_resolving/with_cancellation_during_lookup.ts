// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext } from '../../../commands/CommandContext.js';
import { CommandContextValues } from '../../../commands/CommandContextValues.js';
import { withServices } from '../../../dependencyInjection/ServiceScope.js';
import { readModelForValidation, withCommandValidationContext } from '../../readModelForValidation.js';
import { a_command_with_validation_state, executionContext, State, StateResolver } from '../given/a_command_with_validation_state.js';

describe('when resolving with cancellation during lookup', () => {
    let error: unknown;
    let cancellation: Error;
    let context: a_command_with_validation_state;
    beforeEach(async () => {
        context = new a_command_with_validation_state();
        const controller = new AbortController();
        cancellation = new Error('Lookup canceled');
        let entered!: () => void;
        let release!: (state: State) => void;
        const started = new Promise<void>(resolve => { entered = resolve; });
        const pending = new Promise<State>(resolve => { release = resolve; });
        context.resolver.lookup.callsFake(() => { entered(); return pending; });
        const application = await context.builder.build();
        const command: CommandContext = { ...executionContext('tenant-a', 'command-1', controller.signal),
            key: 'state-1', command: {}, values: new CommandContextValues(), readModelResolvers: [StateResolver] };
        const scope = application.server.services.createScope(command);
        try {
            const lookup = withServices(scope, () => withCommandValidationContext(command, () => readModelForValidation(State, { optional: true })));
            await started;
            controller.abort(cancellation);
            release(new State());
            try { await lookup; } catch (caught) { error = caught; }
        } finally { await scope.dispose(); await application.dispose(); }
    });
    it('should propagate the exact cancellation reason rather than returning state or null', () => {
        (error === cancellation).should.equal(true);
    });
    it('should pass the command cancellation signal to the resolver', () => {
        (context.resolver.lookup.firstCall.args[2] as CommandContext).signal.aborted.should.equal(true);
    });
});
