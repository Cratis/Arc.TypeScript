// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import { defineCommand } from '../../commands/defineCommand.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

function deferred<T>() {
    let release!: (value: T) => void;
    const promise = new Promise<T>(resolve => { release = resolve; });
    return { promise, release };
}

for (const mode of ['execute', 'validate'] as const) for (const stage of ['pre-aborted', 'pre-aborted empty groups', 'resolving authorization',
    'pending authorization', 'resolving pipeline', 'pending pipeline'] as const) {
    describe(`when ${mode} is canceled with ${stage}`, () => {
        let application: FetchArcApplication;
        let result: CommandResult;
        let calls: string[];
        let disposed: number;
        beforeEach(async () => {
            const fixture = new command_filter_fixture();
            calls = fixture.calls;
            disposed = 0;
            const controller = new AbortController();
            const started = deferred<void>();
            const factory = deferred<{ onExecution(context: CommandContext): void }>();
            const filter = deferred<void>();
            class First {
                onExecution(): Promise<void> | void {
                    calls.push('first');
                    if (stage === 'pending authorization' || stage === 'pending pipeline') {
                        started.release();
                        return filter.promise;
                    }
                }
                [Symbol.dispose](): void { disposed++; }
            }
            class Later { onExecution(): void { calls.push('later'); } }
            const builder = fixture.builder;
            builder.services.addScoped(First, () => {
                calls.push('factory');
                if (stage === 'resolving authorization' || stage === 'resolving pipeline') {
                    started.release();
                    return factory.promise;
                }
                return new First();
            }).addScoped(Later);
            if (stage === 'resolving pipeline' || stage === 'pending pipeline') {
                builder.addCommandPipelineFilter(First).addCommandPipelineFilter(Later);
            } else if (stage !== 'pre-aborted empty groups') {
                builder.addAuthorizationCommandFilter(First).addAuthorizationCommandFilter(Later);
            }
            application = await builder.build();
            if (stage === 'pre-aborted' || stage === 'pre-aborted empty groups') controller.abort(new Error('canceled'));
            const running = application.server[mode === 'execute' ? 'executeCommand' : 'validateCommand'](
                'Filtered', { value: 'allowed' }, { ...fixture.execution, signal: controller.signal });
            if (stage !== 'pre-aborted' && stage !== 'pre-aborted empty groups') {
                await started.promise;
                controller.abort(new Error('canceled'));
                factory.release(new First());
                filter.release();
            }
            result = await running;
        });
        afterEach(async () => { await application.dispose(); });
        it('should return an unsuccessful cancellation rather than denial', () => {
            result.isSuccess.should.equal(false);
            result.isAuthorized.should.equal(true);
            result.hasExceptions.should.equal(true);
        });
        it('should not start downstream work after the abort', () => {
            if (stage === 'resolving authorization' || stage === 'resolving pipeline' || stage === 'pre-aborted' || stage === 'pre-aborted empty groups')
                calls.should.not.contain('first');
            calls.should.not.contain('later');
            calls.should.not.contain('validate');
            calls.should.not.contain('local');
            calls.should.not.contain('provide');
            calls.should.not.contain('handle');
        });
        it('should dispose any constructed scoped filters', () => {
            disposed.should.equal(stage === 'pre-aborted' || stage === 'pre-aborted empty groups' ? 0 : 1);
        });
    });
}

describe('when a command is canceled before validator dependencies resolve', () => {
    let application: FetchArcApplication;
    let result: CommandResult;
    let calls: string[];
    beforeEach(async () => {
        calls = [];
        const controller = new AbortController();
        const started = deferred<void>();
        const pending = deferred<void>();
        class Dependency {}
        class Filter {
            onExecution(): Promise<void> { started.release(); return pending.promise; }
        }
        const builder = ArcApplication.createBuilder({ commands: [defineCommand({ name: 'Dependent',
            schema: z.object({}), authorization: { anonymous: true }, validatorDependencies: [Dependency],
            validate: () => { calls.push('validate'); return []; },
            handle: () => { calls.push('handle'); }
        })] });
        builder.services.addScoped(Dependency, () => { calls.push('validator factory'); return new Dependency(); })
            .addScoped(Filter);
        builder.addAuthorizationCommandFilter(Filter);
        application = await builder.build();
        const running = application.server.executeCommand('Dependent', {}, { correlationId: 'cancel-dependent',
            principal: undefined, tenantId: undefined, allowedSeverity: 2, signal: controller.signal });
        await started.promise;
        controller.abort(new Error('canceled'));
        pending.release();
        result = await running;
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail without resolving validator dependencies or running the handler', () => {
        result.isSuccess.should.equal(false);
        calls.should.deep.equal([]);
    });
});
