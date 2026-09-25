// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, command, Severity } from '../../index.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
should();

@command() class RunAfterAbort { handle(): string { return 'done'; } }
function deferred<T>() {
    let release!: (value: T) => void;
    const promise = new Promise<T>(resolve => { release = resolve; });
    return { promise, release };
}
for (const runnerFails of [false, true])
    describe(`when a ${runnerFails ? 'failed' : 'successful'} runner settles after cancellation`, () => {
    let application: FetchArcApplication;
    let result: CommandResult;
    beforeEach(async () => {
        const started = deferred<void>();
        const pending = deferred<void>();
        const controller = new AbortController();
        const builder = ArcApplication.createBuilder();
        builder.add(RunAfterAbort);
        builder.addCommandExecutionRunner(async (context, execute) => {
            const completed = await execute();
            started.release();
            await pending.promise;
            return runnerFails ? { ...completed, isSuccess: false, exceptionMessages: ['runner failed'], hasExceptions: true } : completed;
        });
        application = await builder.build();
        const running = application.server.executeCommand('RunAfterAbort', {}, {
            correlationId: 'runner-cancel', principal: undefined, tenantId: undefined,
            allowedSeverity: Severity.Warning, signal: controller.signal
        });
        await started.promise;
        controller.abort(new Error('canceled'));
        pending.release();
        result = await running;
    });
    afterEach(async () => { await application.dispose(); });
    it('should not return success after cancellation', () => { result.isSuccess.should.equal(false); });
    it('should preserve the runner failure or report cancellation', () => {
        result.exceptionMessages.join(' ').should.contain(runnerFails ? 'runner failed' : 'canceled');
    });
});
