// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import { Severity } from '../../validation/Severity.js';
should();

function deferred<T>() {
    let release!: (value: T) => void;
    const promise = new Promise<T>(resolve => { release = resolve; });
    return { promise, release };
}

for (const mode of ['execute', 'validate'] as const) for (const stage of ['validator factory', 'async validator', 'handler factory',
    'deferred runner', 'pending provide'] as const) {
    if (mode === 'validate' && (stage === 'handler factory' || stage === 'pending provide')) continue;
    describe(`when ${mode} is canceled during ${stage} after filters`, () => {
        let application: FetchArcApplication;
        let result: CommandResult;
        let calls: string[];
        beforeEach(async () => {
            calls = [];
            const controller = new AbortController();
            const started = deferred<void>();
            const pending = deferred<void>();
            class Validator { [Symbol.dispose](): void { calls.push('validator disposed'); } }
            class Handler { [Symbol.dispose](): void { calls.push('handler disposed'); } }
            const builder = ArcApplication.createBuilder({
                ...stage === 'deferred runner' && { commandExecutionRunner: async (_context, execute) => {
                    started.release(); await pending.promise; return execute();
                } },
                commands: [{
                name: 'Later', schema: z.object({}), authorization: { anonymous: true }, validatorDependencies: [Validator],
                handlerDependencies: [Handler],
                validate: async () => {
                    calls.push('validator');
                    if (stage === 'async validator') { started.release(); await pending.promise; }
                    return [];
                },
                scopes: [() => ({ begin: () => { calls.push('scope begin'); }, complete: () => { calls.push('scope complete'); } })],
                provide: async () => {
                    calls.push('provide');
                    if (stage === 'pending provide') { started.release(); await pending.promise; }
                },
                handle: () => { calls.push('handle'); return 'done'; }
            }] });
            builder.services.addScoped(Validator, async () => {
                calls.push('validator factory');
                if (stage === 'validator factory') { started.release(); await pending.promise; }
                return new Validator();
            }).addScoped(Handler, async () => {
                calls.push('handler factory');
                if (stage === 'handler factory') { started.release(); await pending.promise; }
                return new Handler();
            });
            application = await builder.build();
            const running = application.server[mode === 'execute' ? 'executeCommand' : 'validateCommand']('Later', {}, {
                correlationId: 'cancel-after-filter', principal: undefined, tenantId: undefined,
                allowedSeverity: Severity.Warning, signal: controller.signal
            });
            await started.promise;
            controller.abort(new Error('canceled'));
            pending.release();
            result = await running;
        });
        afterEach(async () => { await application.dispose(); });
        it('should report cancellation rather than success', () => {
            result.isSuccess.should.equal(false);
            result.hasExceptions.should.equal(true);
        });
        it('should not start any later business stage', () => {
            if (stage === 'validator factory' || stage === 'deferred runner') calls.should.not.contain('validator');
            if (stage === 'async validator') calls.should.not.contain('handler factory');
            if (stage === 'handler factory') calls.should.not.contain('scope begin');
            calls.should.not.contain('handle');
        });
        it('should complete any started scope and dispose resolved services', () => {
            if (stage === 'pending provide') calls.should.contain('scope complete');
            if (stage === 'validator factory') calls.should.contain('validator disposed');
            if (stage === 'handler factory') calls.should.contain('handler disposed');
        });
    });
}
