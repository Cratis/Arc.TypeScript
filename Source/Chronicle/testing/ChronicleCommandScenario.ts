// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario, type ScenarioCommandResult } from '@cratis/arc.testing';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import { EventSequenceNumber, type AppendOptions, type AppendResult, type EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import { getEventTypeMetadata } from '@cratis/chronicle/events';
import { ReadModelScenario } from '@cratis/chronicle/testing';
import { ChronicleArtifacts } from '../ChronicleArtifacts.js';
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
    readonly #readModels = new Map<ClassType, Map<string, Map<string, unknown>>>();
    readonly #seeded = new Map<string, Map<string, object[]>>();
    readonly #materialized = new Map<string, Map<ClassType, ReadModelScenario<object>>>();
    readonly #catalog = new ChronicleArtifacts();
    readonly #types: ClassType[];
    private constructor(type: ClassType<T>, artifacts: ClassType[]) {
        this.#types = artifacts;
        for (const artifact of artifacts) this.#catalog.register(artifact);
        this.#scenario = CommandScenario.for(type, ...artifacts);
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
                    readModels: { findInstanceById: async (model: ClassType, id: string) => this.#findReadModel(model, id, tenant) }
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
    get given() {
        return {
            /** Select an event source in the current tenant, or specify another tenant. */
            forEventSource: (sourceId: string, tenant = this.context.tenantId ?? 'Default') => ({
            /** Append events to this source's seeded history without recording them as command output. */
            events: (...events: object[]): void => {
                const history = this.#seeded.get(tenant) ?? new Map<string, object[]>();
                const source = history.get(sourceId) ?? [];
                for (const event of events) {
                    if (!this.#catalog.eventTypes.includes(event.constructor as ClassType) || !getEventTypeMetadata(event.constructor))
                        throw new Error(`In-memory Chronicle cannot seed an unregistered event: ${event.constructor.name}`);
                }
                source.push(...events);
                history.set(sourceId, source);
                this.#seeded.set(tenant, history);
                this.#materialized.delete(tenant);
            },
            /** Pin an instance for this source, taking precedence over reducer history. */
            readModel: <R extends object>(instance: R): void => {
                this.givenReadModel(instance.constructor as ClassType<R>, sourceId, instance, tenant);
            }
        }) };
    }
    /** Pin a read model to a source and tenant before executing a command. */
    givenReadModel<R extends object>(type: ClassType<R>, sourceId: string, instance: R, tenant = 'Default'): this {
        const tenants = this.#readModels.get(type) ?? new Map<string, Map<string, unknown>>();
        const values = tenants.get(tenant) ?? new Map<string, unknown>();
        values.set(sourceId, instance);
        tenants.set(tenant, values);
        this.#readModels.set(type, tenants);
        return this;
    }
    async #findReadModel(model: ClassType, id: string, tenant: string): Promise<unknown> {
        const pinned = this.#readModels.get(model)?.get(tenant)?.get(id);
        if (pinned !== undefined) return pinned;
        let byType = this.#materialized.get(tenant);
        if (!byType) { byType = new Map(); this.#materialized.set(tenant, byType); }
        let scenario = byType.get(model);
        if (!scenario) {
            try { scenario = new ReadModelScenario(model, this.#catalog); }
            catch (error) {
                if (error instanceof Error && error.message.startsWith('No reducer found') &&
                    !this.#seeded.get(tenant)?.get(id)?.length) return null;
                if (error instanceof Error && error.message.includes('Projection-backed read model'))
                    throw new Error(`${error.message} Use ChronicleKernelScenario for projections.`, { cause: error });
                throw error;
            }
            for (const [sourceId, events] of this.#seeded.get(tenant) ?? []) scenario.given.forEventSource(sourceId).events(...events);
            byType.set(model, scenario);
        }
        return scenario.instanceForEventSourceId(id);
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
