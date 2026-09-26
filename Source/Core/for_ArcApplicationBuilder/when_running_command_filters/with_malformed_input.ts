// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { unauthorizedCommandResult } from '../../commands/unauthorizedCommandResult.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

async function build(context: command_filter_fixture, calls: { providers: number; resolvers: number }): Promise<FetchArcApplication> {
    class Provider { provide(): Record<string, never> { calls.providers++; throw new Error('Should not provide'); } }
    class Resolver { resolve(): string { calls.resolvers++; throw new Error('Should not resolve'); } }
    class Gate {
        onExecution(command: CommandContext): CommandResult | void {
            if ((command.command as { deny?: boolean }).deny)
                return unauthorizedCommandResult(command, 'Denied malformed input');
        }
    }
    const builder = context.builder;
    builder.services.addScoped(Provider).addScoped(Resolver).addScoped(Gate);
    builder.addCommandContextValuesProvider(Provider).addCommandKeyResolver(Resolver).addAuthorizationCommandFilter(Gate);
    return builder.build();
}

describe('when denying malformed command input', given(command_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: CommandResult;
    let calls: { providers: number; resolvers: number };
    beforeEach(async () => {
        calls = { providers: 0, resolvers: 0 };
        application = await build(context, calls);
        result = await application.server.executeCommand('Filtered', { value: 42, deny: true }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should deny before reporting malformed input', () => { result.isAuthorized.should.equal(false); });
    it('should preserve the denial reason', () => {
        result.authorizationFailureReason.should.equal('Denied malformed input');
    });
    it('should not invoke the provider', () => { calls.providers.should.equal(0); });
    it('should not invoke the resolver', () => { calls.resolvers.should.equal(0); });
}));

describe('when allowing malformed command input', given(command_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: CommandResult;
    let calls: { providers: number; resolvers: number };
    beforeEach(async () => {
        calls = { providers: 0, resolvers: 0 };
        application = await build(context, calls);
        result = await application.server.validateCommand('Filtered', { value: 42 }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should report malformed input', () => { result.validationResults[0]!.reason.should.equal('malformedRequest'); });
    it('should not invoke the provider', () => { calls.providers.should.equal(0); });
    it('should not invoke the resolver', () => { calls.resolvers.should.equal(0); });
}));
