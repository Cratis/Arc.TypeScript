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

describe('when running command filters with malformed input', given(command_filter_fixture, context => {
    let application: FetchArcApplication;
    let denied: CommandResult;
    let allowed: CommandResult;
    let providerCalls: number;
    let resolverCalls: number;
    beforeEach(async () => {
        providerCalls = 0;
        resolverCalls = 0;
        class Provider { provide(): Record<string, never> { providerCalls++; throw new Error('Should not provide'); } }
        class Resolver { resolve(): string { resolverCalls++; throw new Error('Should not resolve'); } }
        class Gate {
            onExecution(command: CommandContext): CommandResult | void {
                if ((command.command as { deny?: boolean }).deny)
                    return unauthorizedCommandResult(command, 'Denied malformed input');
            }
        }
        const builder = context.builder;
        builder.services.addScoped(Provider).addScoped(Resolver).addScoped(Gate);
        builder.addCommandContextValuesProvider(Provider).addCommandKeyResolver(Resolver).addAuthorizationCommandFilter(Gate);
        application = await builder.build();
        denied = await application.server.executeCommand('Filtered', { value: 42, deny: true }, context.execution);
        allowed = await application.server.validateCommand('Filtered', { value: 42 }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should preserve denial on malformed input', () => { denied.isAuthorized.should.equal(false); });
    it('should preserve the denial reason', () => { denied.authorizationFailureReason.should.equal('Denied malformed input'); });
    it('should report malformed input when authorized', () => {
        allowed.validationResults[0]!.reason.should.equal('malformedRequest');
    });
    it('should not run providers on malformed input', () => { providerCalls.should.equal(0); });
    it('should not run resolvers on malformed input', () => { resolverCalls.should.equal(0); });
}));
