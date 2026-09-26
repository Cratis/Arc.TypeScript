// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { commandFilterResult } from '../../commands/commandFilterResult.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

describe('when an asynchronous authorization filter rejects', given(command_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: CommandResult;
    beforeEach(async () => {
        class Reject { async onExecution(): Promise<void> { throw new Error('Rejected'); } }
        const builder = context.builder;
        builder.services.addScoped(Reject);
        builder.addAuthorizationCommandFilter(Reject);
        application = await builder.build();
        result = await application.server.executeCommand('Filtered', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail closed with an exception', () => { result.hasExceptions.should.equal(true); });
    it('should not validate', () => { context.calls.should.deep.equal([]); });
}));

describe('when an ordinary filter throws', given(command_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: CommandResult;
    beforeEach(async () => {
        class Throwing { onExecution(): void { throw new Error('Pipeline failed'); } }
        const builder = context.builder;
        builder.services.addScoped(Throwing);
        builder.addCommandPipelineFilter(Throwing);
        application = await builder.build();
        result = await application.server.executeCommand('Filtered', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail closed with an exception', () => { result.hasExceptions.should.equal(true); });
    it('should not validate', () => { context.calls.should.deep.equal([]); });
}));

describe('when a filter factory fails at runtime', given(command_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: CommandResult;
    beforeEach(async () => {
        class FactoryFilter { onExecution(): void {} }
        const builder = context.builder;
        builder.services.addScoped(FactoryFilter, () => { throw new Error('Factory failed'); });
        builder.addAuthorizationCommandFilter(FactoryFilter);
        application = await builder.build();
        result = await application.server.validateCommand('Filtered', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail closed with an exception', () => { result.hasExceptions.should.equal(true); });
    it('should not validate', () => { context.calls.should.deep.equal([]); });
}));

describe('when an authorization fragment has malformed arrays', given(command_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: CommandResult;
    beforeEach(async () => {
        class Invalid {
            onExecution(command: CommandContext): CommandResult {
                return { ...commandFilterResult(command), validationResults: null } as unknown as CommandResult;
            }
        }
        const builder = context.builder;
        builder.services.addScoped(Invalid);
        builder.addAuthorizationCommandFilter(Invalid);
        application = await builder.build();
        result = await application.server.executeCommand('Filtered', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail closed with an exception', () => { result.hasExceptions.should.equal(true); });
    it('should not validate', () => { context.calls.should.deep.equal([]); });
}));
