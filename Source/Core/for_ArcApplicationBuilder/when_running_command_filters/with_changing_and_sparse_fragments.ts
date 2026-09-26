// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import { Severity } from '../../validation/Severity.js';
import { validation } from '../../validation/ValidationResult.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

for (const [name, fragment] of [
    ['inherited authorization', Object.create({ isAuthorized: 'false' })],
    ['sparse warning members', { validationResults: [validation('warning', new Array<string>(1), 'rule', Severity.Warning)] }],
    ['sparse validation results', { validationResults: new Array(1) }],
    ['sparse exception messages', { exceptionMessages: new Array(1) }]
] as const) for (const mode of ['execute', 'validate'] as const) describe(`when ${mode} sees ${name}`, () => {
    let application: FetchArcApplication;
    let result: CommandResult;
    const fixture = new command_filter_fixture();
    beforeEach(async () => {
        fixture.calls.length = 0;
        class Invalid { onExecution(): CommandResult { return fragment as CommandResult; } }
        const builder = fixture.builder;
        builder.services.addScoped(Invalid);
        builder.addAuthorizationCommandFilter(Invalid);
        application = await builder.build();
        result = await application.server[mode === 'execute' ? 'executeCommand' : 'validateCommand'](
            'Filtered', { value: 'allowed' }, fixture.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail closed before starting validation or business code', () => {
        result.isSuccess.should.equal(false);
        result.hasExceptions.should.equal(true);
        fixture.calls.should.deep.equal([]);
    });
});

for (const [name, make] of [
    ['changing authorization', () => ({ get isAuthorized() { return this.reads++ === 0 ? false : true; }, reads: 0 })],
    ['changing severity', () => ({ validationResults: [{ get severity() { return this.reads++ === 0 ? Severity.Error : NaN; },
        reads: 0, message: 'error', members: [], reason: 'rule' }] })]
] as const) describe(`when command authorization returns ${name}`, () => {
    let application: FetchArcApplication;
    let result: CommandResult;
    const fixture = new command_filter_fixture();
    beforeEach(async () => {
        fixture.calls.length = 0;
        const fragment = make();
        class Filter { onExecution(): CommandResult { return fragment as unknown as CommandResult; } }
        const builder = fixture.builder;
        builder.services.addScoped(Filter);
        builder.addAuthorizationCommandFilter(Filter);
        application = await builder.build();
        result = await application.server.executeCommand('Filtered', { value: 'allowed' }, fixture.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should remain unsuccessful and never start business code', () => {
        result.isSuccess.should.equal(false);
        fixture.calls.should.deep.equal([]);
    });
});
