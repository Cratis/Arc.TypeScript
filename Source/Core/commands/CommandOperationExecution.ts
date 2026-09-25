// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { currentServices } from '../dependencyInjection/ServiceScope.js';
import type { CommandContext } from './CommandContext.js';
import type { CommandCommitDisposition } from './CommandCommitDisposition.js';
import { isCommandOperation, type CommandOperation } from './CommandOperation.js';
import { CommandOperationBoundary } from './CommandOperationBoundary.js';
import type { CommandOperationFailure } from './CommandOperationFailure.js';
import type { CommandOperationOutcome } from './CommandOperationOutcome.js';
import type { CommandRecoverySummary } from './CommandRecoverySummary.js';

type Invocation = { operation: CommandOperation; execution: unknown[]; compensation: unknown[] };
/** Preflighted invocation journal; execution and cleanup use separate cancellation lifetimes. */
export class CommandOperationExecution {
    readonly #planned: Invocation[] = [];
    readonly outcomes: CommandOperationOutcome[] = [];
    failedIndex: number | undefined;
    private constructor(readonly timeoutMs: number) {}
    /** Validate every declaration before constructing any dependency or starting work. */
    static async plan(operations: readonly CommandOperation[], timeoutMs: number): Promise<CommandOperationExecution> {
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 4_294_967_294)
            throw new Error('Compensation timeout must be positive and at most 4294967294 milliseconds');
        for (const operation of operations) {
            if (!isCommandOperation(operation) || typeof operation.execute !== 'function' ||
                operation.compensate !== undefined && typeof operation.compensate !== 'function' ||
                operation.executeDependencies !== undefined && !Array.isArray(operation.executeDependencies) ||
                operation.compensateDependencies !== undefined && !Array.isArray(operation.compensateDependencies) ||
                !operation.compensate && operation.compensateDependencies?.length)
                throw new Error('Invalid command operation declaration');
            if (operation.execute.length !== 1 + (operation.executeDependencies?.length ?? 0) ||
                operation.compensate && operation.compensate.length !== 2 + (operation.compensateDependencies?.length ?? 0))
                throw new Error('Command operation methods require explicit signal and dependency parameters; default and rest parameters are unsupported');
        }
        const services = currentServices();
        const planned = new CommandOperationExecution(timeoutMs);
        for (const operation of operations) {
            services.registry.preflight([...(operation.executeDependencies ?? []), ...(operation.compensateDependencies ?? [])]);
        }
        for (const operation of operations) {
            const execution = await Promise.all((operation.executeDependencies ?? []).map(token => services.resolve(token)));
            const compensation = await Promise.all((operation.compensateDependencies ?? []).map(token => services.resolve(token)));
            planned.#planned.push({ operation, execution, compensation });
        }
        return planned;
    }
    /** Run declarations in order, recording entry before each call. */
    async execute(context: CommandContext): Promise<void> {
        for (const [index, invocation] of this.#planned.entries()) {
            if (context.signal.aborted) throw context.signal.reason ?? new Error('Command canceled');
            const outcome: CommandOperationOutcome = { invocationIndex: index,
                operationType: invocation.operation.constructor.name, executionCompleted: false, compensation: 'NotNeeded' };
            this.outcomes.push(outcome);
            try {
                await CommandOperationBoundary.run(async () => invocation.operation.execute(context.signal, ...invocation.execution));
                outcome.executionCompleted = true;
            } catch (error) { this.failedIndex = index; throw error; }
        }
        if (context.signal.aborted) throw context.signal.reason ?? new Error('Command canceled');
    }
    /** Recover only when commitment is known absent; callbacks share one cooperative cleanup budget. */
    async recover(disposition: CommandCommitDisposition, failure: readonly string[], source: CommandOperationFailure['source']): Promise<CommandRecoverySummary> {
        const eligible = disposition === 'NoCommit' || disposition === 'NotCommitted';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            if (failure.length && !eligible) for (const outcome of this.outcomes) outcome.compensation = 'Suppressed';
            else if (failure.length) for (let index = this.outcomes.length - 1; index >= 0; index--) {
                const outcome = this.outcomes[index]!;
                const invocation = this.#planned[index]!;
                if (!invocation.operation.compensate) { outcome.compensation = 'NotAvailable'; continue; }
                if (controller.signal.aborted) { outcome.compensation = 'BudgetExpired'; continue; }
                const detail: CommandOperationFailure = Object.freeze({ invocationIndex: index,
                    invocationCompleted: outcome.executionCompleted, isFailingInvocation: index === this.failedIndex,
                    source, commitDisposition: disposition, exceptionMessages: Object.freeze([...failure]) });
                try {
                    await CommandOperationBoundary.run(async () => invocation.operation.compensate!(detail, controller.signal, ...invocation.compensation));
                    outcome.compensation = controller.signal.aborted ? 'BudgetExpired' : 'Completed';
                } catch (error) { outcome.compensation = 'Failed'; outcome.compensationFailure = String(error); }
            }
        } finally { clearTimeout(timer); }
        const compensatedCount = this.outcomes.filter(outcome => outcome.compensation === 'Completed').length;
        return {
            commitDisposition: disposition,
            status: !failure.length || !this.outcomes.length ? 'NotNeeded' : !eligible ?
                disposition === 'Committed' ? 'Suppressed' : 'Indeterminate' :
                compensatedCount === this.outcomes.length ? 'Completed' : 'Incomplete',
            startedCount: this.outcomes.length,
            completedCount: this.outcomes.filter(outcome => outcome.executionCompleted).length,
            compensatedCount,
            failedCompensationCount: this.outcomes.filter(outcome => outcome.compensation === 'Failed').length,
            uncompensatedCount: failure.length ? this.outcomes.length - compensatedCount : 0
        };
    }
}
