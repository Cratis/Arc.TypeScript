// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { IEventStore } from '@cratis/chronicle';
import type { AppendOptions, ConcurrencyScope, EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import type { CommandContext, CommandResult } from '@cratis/arc.core';
import { checkResults } from './ChronicleCommand.js';

const current = new AsyncLocalStorage<ChronicleUnitOfWork>();

/** One returned-event batch for the entire nested Arc command chain. Not a cross-store transaction. */
export class ChronicleUnitOfWork {
    readonly #entries: EventForEventSourceId[] = [];
    readonly #scopes: Record<string, ConcurrencyScope> = {};
    #store?: IEventStore;
    #nestedFailure = false;
    constructor(private readonly context: CommandContext) {}
    static active(): ChronicleUnitOfWork | undefined { return current.getStore(); }
    static run<T>(unit: ChronicleUnitOfWork, work: () => Promise<T>): Promise<T> { return current.run(unit, work); }
    stage(store: IEventStore, context: CommandContext, entries: readonly EventForEventSourceId[], options: AppendOptions): void {
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
        if (!result.isSuccess) this.#nestedFailure = true;
        return result;
    }
    async commit(result: CommandResult): Promise<CommandResult> {
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
            const outcome = checkResults(await this.#store!.eventLog.appendMany(entries, options), entries.length);
            if (!outcome) return result;
            if (outcome.kind !== 'validation') throw new Error('Unexpected Chronicle append outcome');
            return { ...result, response: undefined, validationResults: outcome.results,
                isValid: false, isSuccess: false };
        } catch (error) {
            return { ...result, response: undefined, exceptionMessages: [...result.exceptionMessages, String(error)],
                exceptionStackTrace: error instanceof Error ? error.stack ?? '' : '', hasExceptions: true, isSuccess: false };
        }
    }
}
