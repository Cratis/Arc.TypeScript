// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { randomUUID } from 'node:crypto';
import { JsonSerializer } from '@cratis/fundamentals';
import { getEventTypeFor } from '@cratis/chronicle/events';
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';
import type { IEventStore } from '@cratis/chronicle';
import type { AppendedEvent } from '@cratis/chronicle/events';
import type { EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import { CommandScenario, type ScenarioCommandResult } from '@cratis/arc.testing';
import { ChronicleArtifacts } from '../ChronicleArtifacts.js';
import { checkResults } from '../ChronicleCommand.js';
import { waitForProjectionCompletion } from '../waitForProjectionCompletion.js';
import '../withChronicle.js';

type ClassType<T extends object = object> = new () => T;

/** A fresh event store per scenario, backed by an existing real Chronicle kernel. Never starts a kernel in CI. */
export class ChronicleKernelScenario<T extends object> {
    readonly given: { events: (...events: EventForEventSourceId[]) => Promise<void> };
    readonly #scenario: CommandScenario<T>;
    readonly #client: ChronicleClient;
    readonly #eventStore: string;
    readonly #tenant: string;
    readonly #timeoutMs: number;
    #disposed = false;
    private constructor(type: ClassType<T>, artifacts: ClassType[], connectionString: string, timeoutMs: number) {
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Chronicle completion timeout must be a positive integer in milliseconds');
        this.#eventStore = `ArcTsScenario${randomUUID().replaceAll('-', '')}`;
        this.#tenant = 'Default';
        this.#timeoutMs = timeoutMs;
        const catalog = new ChronicleArtifacts();
        for (const artifact of [type, ...artifacts]) catalog.register(artifact);
        this.#client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString, {
            clientArtifactsProvider: catalog, discoveryPatterns: []
        }));
        this.#scenario = CommandScenario.for(type, ...artifacts).withContext({ tenantId: this.#tenant });
        this.#scenario.extend(builder => { builder.withChronicle({ client: this.#client, eventStore: this.#eventStore, completionTimeoutMs: timeoutMs }); });
        this.given = { events: async (...events) => {
            if (!events.length) return;
            const results = await (await this.store()).eventLog.appendMany(events);
            const failure = checkResults(results, events.length);
            if (failure) throw new Error(`Chronicle seed was rejected: ${JSON.stringify(failure)}`);
            await waitForProjectionCompletion(results, this.#timeoutMs, new AbortController().signal);
        } };
    }
    /** Connect to ARC_CHRONICLE_TEST_URL (or an explicit connection string). A running kernel is required. */
    static for<T extends object>(type: ClassType<T>, artifacts: ClassType[], options: { connectionString?: string; timeoutMs?: number } = {}): ChronicleKernelScenario<T> {
        const connectionString = options.connectionString ?? process.env.ARC_CHRONICLE_TEST_URL;
        if (!connectionString) throw new Error('ARC_CHRONICLE_TEST_URL is required for a kernel scenario');
        return new ChronicleKernelScenario(type, artifacts, connectionString, options.timeoutMs ?? 10000);
    }
    get context() { return this.#scenario.context; }
    get eventStoreName(): string { return this.#eventStore; }
    async store(): Promise<IEventStore> {
        if (this.#disposed) throw new Error('Chronicle kernel scenario is disposed');
        return this.#client.getEventStore(this.#eventStore, this.#tenant);
    }
    /** Execute the real Arc pipeline and inspect only events appended by this call (not seeded events). */
    async execute(command: T | Partial<T>): Promise<ScenarioCommandResult & {
        appendedEvents: readonly AppendedEvent[];
        shouldHaveAppendedEvent<E>(type: new (...args: never[]) => E, sourceId?: string, predicate?: (event: E) => boolean): void;
    }> {
        const store = await this.store();
        const next = await store.eventLog.getNextSequenceNumber();
        const result = await this.#scenario.execute(command);
        const appendedEvents = await store.eventLog.getFromSequenceNumber(next);
        return Object.assign(result, { appendedEvents, shouldHaveAppendedEvent: <E>(type: new (...args: never[]) => E,
            sourceId?: string, predicate?: (event: E) => boolean) => {
            if (!appendedEvents.some(item => item.eventType.id.value === getEventTypeFor(type).id.value &&
                (sourceId === undefined || item.context.eventSourceId === sourceId) &&
                (predicate === undefined || predicate(JsonSerializer.deserialize(type as new () => object, JSON.stringify(item.content)) as E))))
                throw new Error(`Expected ${type.name} to have been appended${sourceId ? ` to ${sourceId}` : ''}`);
        } });
    }
    /** Assert against the actual kernel read-model service after observer completion. */
    async shouldHaveReadModel<R extends object>(type: ClassType<R>, id: string, predicate?: (model: R) => boolean): Promise<R> {
        const model = await (await this.store()).readModels.findInstanceById(type, id);
        if (!model || (predicate && !predicate(model))) throw new Error(`Expected ${type.name} read model for ${id}`);
        return model;
    }
    async dispose(): Promise<void> {
        if (this.#disposed) return;
        this.#disposed = true;
        try { await this.#scenario.dispose(); } finally { this.#client.dispose(); }
    }
}
