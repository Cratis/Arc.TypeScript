// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { IEventStore } from '@cratis/chronicle';
import type { AppendOptions, ConcurrencyScope, EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import type { CommandContext, CommandResult } from '@cratis/arc.core';
import { recordFailure } from '@cratis/arc.core/hosting';
import { CommandCommitDisposition } from '@cratis/arc.core';
import { checkResults } from './ChronicleCommand.js';
import type { AggregateRoot } from './AggregateRoot.js';
import { waitForProjectionCompletion } from './waitForProjectionCompletion.js';

const current = new AsyncLocalStorage<ChronicleUnitOfWork>();

/** One returned-event batch for the entire nested Arc command chain. Not a cross-store transaction. */
export class ChronicleUnitOfWork {
    readonly #entries: EventForEventSourceId[] = [];
    readonly #aggregates = new Set<AggregateRoot>();
    readonly #scopes: Record<string, ConcurrencyScope> = {};
    #store?: IEventStore;
    #nestedFailure = false;
    #completed = false;
    disposition: CommandCommitDisposition = CommandCommitDisposition.NoCommit;
    get hasStagedEvents(): boolean { return this.#entries.length > 0 || [...this.#aggregates].some(aggregate => aggregate.hasUnstagedEvents); }
    track(aggregate: AggregateRoot): void { this.#aggregates.add(aggregate); }
    aggregates(): AggregateRoot[] { return [...this.#aggregates]; }
    constructor(readonly context: CommandContext) {}
    static active(): ChronicleUnitOfWork | undefined {
        const unit = current.getStore();
        return unit && !unit.#completed ? unit : undefined;
    }
    static run<T>(unit: ChronicleUnitOfWork, work: () => Promise<T>): Promise<T> { return current.run(unit, work); }
    stage(store: IEventStore, context: CommandContext, entries: readonly EventForEventSourceId[], options: AppendOptions): void {
        if (this.#completed) throw new Error('Cannot stage events in a completed Chronicle unit of work');
        if (context.tenantId !== this.context.tenantId || context.correlationId !== this.context.correlationId)
            throw new Error('Nested Chronicle commands must share tenant and correlation ID');
        if (this.#store && this.#store !== store)
            throw new Error('Nested Chronicle commands must use the same event store and namespace');
        this.#store = store;
        for (const [name, scope] of Object.entries(options.concurrencyScopes ?? {})) {
            if (this.#scopes[name] && JSON.stringify(this.#scopes[name], (_, value) => typeof value === 'bigint' ? value.toString() : value) !==
                JSON.stringify(scope, (_, value) => typeof value === 'bigint' ? value.toString() : value))
                throw new Error(`Conflicting Chronicle concurrency scope: ${name}`);
            this.#scopes[name] = scope;
        }
        this.#entries.push(...entries);
    }
    nestedCompleted(result: CommandResult): CommandResult {
        if (this.#completed) throw new Error('Cannot complete a nested command in a completed Chronicle unit of work');
        if (!result.isSuccess) this.#nestedFailure = true;
        return result;
    }
    async commit(result: CommandResult, completionTimeoutMs?: number): Promise<CommandResult> {
        if (this.#completed) throw new Error('Chronicle unit of work has already completed');
        this.#completed = true;
        if (!result.isSuccess) return result;
        if (this.#nestedFailure) return { ...result, response: undefined,
            exceptionMessages: [...result.exceptionMessages, 'Nested Chronicle command failed; staged events were discarded'],
            hasExceptions: true, isSuccess: false };
        if (!this.#entries.length) return result;
        const entries = [...this.#entries];
        const options: AppendOptions = { correlationId: this.context.correlationId,
            ...(Object.keys(this.#scopes).length ? { concurrencyScopes: { ...this.#scopes } } : {}) };
        try {
            this.context.signal.throwIfAborted();
            this.disposition = CommandCommitDisposition.Unknown;
            const appended = await this.#store!.eventLog.appendMany(entries, options);
            const outcome = checkResults(appended, entries.length);
            if (!outcome) {
                this.disposition = CommandCommitDisposition.Committed;
                await waitForProjectionCompletion(appended, completionTimeoutMs, this.context.signal);
                return result;
            }
            if (outcome.kind !== 'validation') throw new Error('Unexpected Chronicle append outcome');
            this.disposition = CommandCommitDisposition.NotCommitted;
            return { ...result, response: undefined, validationResults: outcome.results,
                isValid: false, isSuccess: false };
        } catch (error) {
            if (!this.#store || this.disposition !== CommandCommitDisposition.Unknown)
                this.disposition = CommandCommitDisposition.NotCommitted;
            const failed = { ...result, response: undefined, exceptionMessages: [...result.exceptionMessages, String(error)],
                exceptionStackTrace: error instanceof Error ? error.stack ?? '' : '', hasExceptions: true, isSuccess: false };
            recordFailure(failed, error, result);
            return failed;
        }
    }
}
