// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should, vi } from 'vitest';
import { z } from 'zod';
import { ArcServer, Severity, denied } from '@cratis/arc.core';
import type { ExecutionContext, Outcome } from '@cratis/arc.core';
import type { IChronicleClient } from '@cratis/chronicle';
import type { AppendResult, IEventSequence } from '@cratis/chronicle/eventSequences';
import { defineChronicleCommand } from '../../index.js';

should();

class Placed { constructor(readonly name: string) {} }

describe('when produced values change while an event store is being resolved', () => {
    it('should retain the event list, routing metadata and preflighted response', async () => {
        const occurred = new Date('2026-01-01T00:00:00.000Z');
        const tags = ['original-tag'];
        const entry = { eventSourceId: 'original', event: new Placed('first'), subject: 'original-subject', occurred, tags };
        const produced = { events: [entry], response: 'done' as string | Outcome<never> };
        const accepted: AppendResult = {
            sequenceNumber: { value: 1n, isBefore: other => 1n < other.value, isAfter: other => 1n > other.value, toString: () => '1' },
            constraintViolations: [], errors: [], isSuccess: true,
            waitForCompletion: async () => ({ isSuccess: true, failedPartitions: [] })
        };
        const append = vi.fn<IEventSequence['append']>(async () => accepted);
        const client = {
            getEventStore: async () => {
                entry.eventSourceId = 'changed';
                entry.subject = 'changed-subject';
                occurred.setUTCFullYear(2030);
                tags.push('changed-tag');
                produced.events.length = 0;
                produced.response = denied();
                return { eventTypes: { all: [Placed] }, eventLog: { append } };
            }
        } as unknown as IChronicleClient;
        const command = defineChronicleCommand({ name: 'Place', schema: z.object({}), client,
            eventStore: 'Tasks', namespaceForContext: () => 'tenant', produce: () => produced });
        const context: ExecutionContext = { correlationId: crypto.randomUUID(), tenantId: 'tenant', principal: undefined,
            signal: new AbortController().signal, allowedSeverity: Severity.Warning };
        const result = await new ArcServer({ commands: [command] }).executeCommand('Place', {}, context);
        result.isSuccess.should.equal(true);
        should().equal(result.response, 'done');
        append.mock.calls.should.have.lengthOf(1);
        append.mock.calls[0]![0].should.equal('original');
        should().equal(append.mock.calls[0]![2]?.subject, 'original-subject');
        should().equal(append.mock.calls[0]![2]?.occurred?.toISOString(), '2026-01-01T00:00:00.000Z');
        append.mock.calls[0]![2]!.tags!.should.deep.equal(['original-tag']);
    });
});
