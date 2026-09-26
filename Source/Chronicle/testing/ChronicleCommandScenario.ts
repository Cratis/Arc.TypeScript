// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario, type ScenarioCommandResult } from '@cratis/arc.testing';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import { EventSequenceNumber, type AppendOptions, type AppendResult, type EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import { ChronicleScenarioReadModels } from './ChronicleScenarioReadModels.js';
import '../withChronicle.js';

type ClassType<T extends object = object> = new () => T;

interface Appended { readonly tenant: string; readonly source: string; readonly event: object;
    readonly eventSourceType?: string; readonly eventStreamType?: string; readonly eventStreamId?: string;
    readonly subject?: string; readonly tags?: EventForEventSourceId['tags'] }
type AppendedEventAssertion = {
    readonly appendedEvents: readonly Appended[];
    shouldHaveAppendedEvent<E>(type: new (...args: never[]) => E, eventSourceId?: string,
        predicate?: (event: E) => boolean): void;
};

/** In-memory command scenario for returned Chronicle events, without a kernel or constraint enforcement. */
export class ChronicleCommandScenario<T extends object> {
    readonly #scenario: CommandScenario<T>;
    readonly #appended: Appended[] = [];
    readonly #readModels: ChronicleScenarioReadModels;
    readonly #types: ClassType[];
    private constructor(type: ClassType<T>, artifacts: ClassType[]) {
        this.#types = artifacts;
        this.#scenario = CommandScenario.for(type, ...artifacts);
        this.#readModels = new ChronicleScenarioReadModels(artifacts, () => this.context.tenantId);
        const stores = new Map<string, IEventStore>();
        const client = { getEventStore: async (_name: string, tenant: string) => {
            let store = stores.get(tenant);
            if (!store) {
                const eventLog = {
                    appendMany: async (entries: EventForEventSourceId[], options?: AppendOptions): Promise<AppendResult[]> => {
                        // The scenario records routing and supports the caller's scope lookup; only the live kernel enforces concurrency.
                        void options;
                        if (!entries.every(entry => this.#types.includes(entry.event.constructor as ClassType)))
                            throw new Error('In-memory Chronicle cannot append an unregistered event');
                        const start = this.#appended.length;
                        for (const entry of entries) this.#appended.push({ tenant, source: entry.eventSourceId, event: entry.event,
                            eventSourceType: entry.eventSourceType, eventStreamType: entry.eventStreamType,
                            eventStreamId: entry.eventStreamId, subject: entry.subject, tags: entry.tags });
                        return entries.map((_, index) => ({ sequenceNumber: new EventSequenceNumber(BigInt(start + index)),
                            isSuccess: true, errors: [], constraintViolations: [],
                            waitForCompletion: async () => ({ isSuccess: true, failedPartitions: [] }) }) as AppendResult);
                    },
                    getTailSequenceNumber: async (id: string) => new EventSequenceNumber(BigInt(
                        this.#appended.filter(item => item.tenant === tenant && item.source === id).length)),
                    getForEventSourceIdAndEventTypes: async (): Promise<never> => {
                        throw new Error('In-memory Chronicle cannot rehydrate commandAggregate; use ChronicleKernelScenario');
                    }
                };
                store = { eventLog, eventTypes: { all: this.#types },
                    readModels: this.#readModels.forTenant(tenant)
                } as unknown as IEventStore;
                stores.set(tenant, store);
            }
            return store;
        } } as IChronicleClient;
        this.#scenario.extend(builder => { builder.withChronicle({ eventStore: 'InMemoryScenario', client }); });
    }
    static for<T extends object>(type: ClassType<T>, ...artifacts: ClassType[]): ChronicleCommandScenario<T> {
        return new ChronicleCommandScenario(type, artifacts);
    }
    get context() { return this.#scenario.context; }
    /** Seed event history for a source in the current tenant, or an explicitly named tenant. */
    get given() { return this.#readModels.given; }
    /** Pin a read model to a source and tenant before executing a command. */
    givenReadModel<R extends object>(type: ClassType<R>, sourceId: string, instance: R, tenant?: string): this {
        this.#readModels.givenReadModel(type, sourceId, instance, tenant);
        return this;
    }
    /** Execute the command and assert only events produced by that execution, never seeded history. */
    async execute(command: T | Partial<T>): Promise<ScenarioCommandResult & AppendedEventAssertion> {
        const start = this.#appended.length;
        const result = await this.#scenario.execute(command);
        const appended = this.#appended.slice(start);
        return Object.assign(result, { appendedEvents: appended,
            shouldHaveAppendedEvent: <E>(type: new (...args: never[]) => E,
            eventSourceId?: string, predicate?: (event: E) => boolean): void => {
            const matches = appended.filter(item => item.event instanceof type &&
                (eventSourceId === undefined || item.source === eventSourceId) &&
                (predicate === undefined || predicate(item.event as E)));
            if (!matches.length) throw new Error(
                `Expected ${type.name} to have been appended${eventSourceId ? ` to ${eventSourceId}` : ''}`);
        } });
    }
    /** Every event appended by commands, excluding seeded history. */
    get appendedEvents(): readonly Appended[] { return [...this.#appended]; }
    /** Release the underlying command scenario. */
    dispose(): Promise<void> { return this.#scenario.dispose(); }
}
