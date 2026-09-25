// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, acknowledgeCommandCommit, command, Severity } from '../../index.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import { CommandCommitDisposition } from '../../commands/CommandCommitDisposition.js';
import { CommandOperationCompensation } from '../../commands/CommandOperationCompensation.js';
import { CommandRecoveryStatus } from '../../commands/CommandRecoveryStatus.js';
import { CommandOperation } from '../../commands/CommandOperation.js';
import { tuple } from '../../commands/tuple.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
should();

class SuccessfulOperation extends CommandOperation { execute(signal: AbortSignal): void { void signal; } }
@command() class RunAfterAbort { handle() { return tuple('done', new SuccessfulOperation()); } }
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
    if (!runnerFails) {
        it('should retain recovery and executed operation outcomes on the cancellation failure', () => {
            result.recovery!.commitDisposition.should.equal(CommandCommitDisposition.NoCommit);
            result.recovery!.status.should.equal(CommandRecoveryStatus.NotNeeded);
            result.recovery!.startedCount.should.equal(1);
            result.operationOutcomes!.map(outcome => [outcome.operationType, outcome.executionCompleted, outcome.compensation])
                .should.deep.equal([['SuccessfulOperation', true, CommandOperationCompensation.NotNeeded]]);
        });
        it('should keep recovery and operation outcomes out of the JSON result', () => {
            JSON.stringify(result).should.not.contain('recovery');
            JSON.stringify(result).should.not.contain('operationOutcomes');
        });
    }
});

describe('when an inline business commit was acknowledged before runner cancellation', () => {
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
            acknowledgeCommandCommit(context);
            started.release();
            await pending.promise;
            return completed;
        });
        application = await builder.build();
        const running = application.server.executeCommand('RunAfterAbort', {}, {
            correlationId: 'runner-committed', principal: undefined, tenantId: undefined,
            allowedSeverity: Severity.Warning, signal: controller.signal
        });
        await started.promise;
        controller.abort(new Error('canceled'));
        pending.release();
        result = await running;
    });
    afterEach(async () => { await application.dispose(); });
    it('should retain the successful response after an acknowledged inline commit', () => {
        result.isSuccess.should.equal(true);
        result.response!.should.equal('done');
    });
});
