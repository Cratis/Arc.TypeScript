// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import { defineCommand } from '../../commands/defineCommand.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { Severity } from '../../validation/Severity.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

const invalid: [string, object][] = [
    ['string authorization', { isAuthorized: 'false' }],
    ['numeric authorization', { isAuthorized: 0 }],
    ['null authorization', { isAuthorized: null }],
    ['invalid denial reason', { authorizationFailureReason: 12 }],
    ['NaN severity', { validationResults: [{ severity: NaN, message: 'rule', members: [], reason: 'rule' }] }],
    ['infinite severity', { validationResults: [{ severity: Infinity, message: 'rule', members: [], reason: 'rule' }] }],
    ['out-of-range severity', { validationResults: [{ severity: Severity.Error + 1, message: 'rule', members: [], reason: 'rule' }] }],
    ['invalid members', { validationResults: [{ severity: Severity.Error, message: 'rule', members: [42], reason: 'rule' }] }]
];

for (const [name, fragment] of invalid) for (const mode of ['execute', 'validate'] as const) {
    describe(`when ${mode} receives ${name} from command authorization`, () => {
        let application: FetchArcApplication;
        let result: CommandResult;
        const context = new command_filter_fixture();
        let later = 0;
        beforeEach(async () => {
            context.calls.length = 0;
            later = 0;
            class Invalid { onExecution(): CommandResult { return fragment as CommandResult; } }
            class Later { onExecution(): void { later++; } }
            const builder = context.builder;
            builder.services.addScoped(Invalid).addScoped(Later);
            builder.addAuthorizationCommandFilter(Invalid).addAuthorizationCommandFilter(Later)
                .addCommandPipelineFilter(context.pipeline);
            application = await builder.add(context.pipeline).build();
            result = await application.server[mode === 'execute' ? 'executeCommand' : 'validateCommand'](
                'Filtered', { value: 'allowed' }, context.execution);
        });
        afterEach(async () => { await application.dispose(); });
        it('should fail closed rather than authorize', () => {
            result.isSuccess.should.equal(false);
            result.hasExceptions.should.equal(true);
        });
        it('should not run later filters or validators or handlers', () => {
            later.should.equal(0);
            context.calls.should.deep.equal([]);
        });
    });
}

describe('when malformed command authorization precedes validator dependencies', () => {
    let application: FetchArcApplication;
    let result: CommandResult;
    let constructed: number;
    let handled: number;
    beforeEach(async () => {
        constructed = 0;
        handled = 0;
        class Dependency {}
        class Invalid { onExecution(): CommandResult { return { isAuthorized: 'false' } as unknown as CommandResult; } }
        const builder = ArcApplication.createBuilder({ commands: [defineCommand({ name: 'Dependent',
            schema: z.object({}), authorization: { anonymous: true }, validatorDependencies: [Dependency],
            handlerDependencies: [Dependency], handle: () => { handled++; }
        })] });
        builder.services.addScoped(Invalid).addScoped(Dependency, () => { constructed++; return new Dependency(); });
        builder.addAuthorizationCommandFilter(Invalid);
        application = await builder.build();
        result = await application.server.executeCommand('Dependent', {}, {
            correlationId: 'invalid-dependency', principal: undefined, tenantId: undefined,
            allowedSeverity: Severity.Warning, signal: new AbortController().signal
        });
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail before constructing validators or handlers', () => {
        result.isSuccess.should.equal(false);
        constructed.should.equal(0);
        handled.should.equal(0);
    });
});
