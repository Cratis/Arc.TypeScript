// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { z } from 'zod';
import { ArcServer, Severity } from '@cratis/arc.core';
import type { ExecutionContext, Outcome } from '@cratis/arc.core';
import type { AppendResult, EventForEventSourceId, EventSequenceNumber } from '@cratis/chronicle/eventSequences';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import type { IEventTypes } from '@cratis/chronicle/events';
import { defineChronicleCommand } from '../../ChronicleCommand.js';

export class Placed { constructor(readonly name: string) {} }
export class NotRegistered { constructor(readonly name: string) {} }
export const sequenceNumber = (value: bigint): EventSequenceNumber => ({ value, isBefore: other => value < other.value, isAfter: other => value > other.value, toString: () => value.toString() });
export const executionContext = (tenantId: string, correlationId = crypto.randomUUID()): ExecutionContext =>
    ({ tenantId, correlationId, principal: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Warning });
export const accepted = (): AppendResult => ({ sequenceNumber: sequenceNumber(1n), constraintViolations: [], errors: [], isSuccess: true,
    waitForCompletion: async () => ({ isSuccess: true, failedPartitions: [] }) });
export const constraint = (): AppendResult => ({ ...accepted(), isSuccess: false, constraintViolations: [{ constraintId: 'unique', message: 'already taken', details: {} }] });
export const concurrency = (): AppendResult => ({ ...accepted(), isSuccess: false,
    concurrencyViolation: { eventSourceId: 'a', expectedSequenceNumber: sequenceNumber(1n), actualSequenceNumber: sequenceNumber(2n) } });

export class a_command_with_typed_ports {
    setup(
        result: () => Promise<AppendResult[]>,
        create: () => EventForEventSourceId[] = () => [{ eventSourceId: 'a', event: new Placed('first'), subject: 'person-1', eventStreamType: 'tasks', tags: ['created'] }],
        registered: IEventTypes['all'] = [Placed],
        producedResponse: string | Outcome<string> = 'done'
    ) {
        const appendMany = sinon.stub().callsFake(async (events: object[], options: object) => { void events; void options; return result(); });
        const append = sinon.stub().callsFake(async (sourceId: string, event: object, options: object) => {
            void sourceId; void event; void options;
            const results = await result();
            if (results.length !== 1) throw new Error('Single append did not return one result');
            return results[0]!;
        });
        const eventTypes = { all: registered } satisfies Pick<IEventTypes, 'all'>;
        const getEventStore = sinon.stub().callsFake(async (store: string, tenant: string) => {
            void store; void tenant;
            return { eventLog: { append, appendMany }, eventTypes } as unknown as IEventStore;
        });
        const client = { getEventStore } as unknown as IChronicleClient;
        const command = defineChronicleCommand({ name: 'Place', schema: z.object({}), client, eventStore: 'Tasks',
            namespaceForContext: ctx => ctx.tenantId ?? '', produce: () => ({ events: create(), response: producedResponse }) });
        const server = new ArcServer({ commands: [command] });
        return { server, append, appendMany, getEventStore };
    }
}
