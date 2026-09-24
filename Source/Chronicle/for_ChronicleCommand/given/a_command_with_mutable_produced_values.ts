// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { z } from 'zod';
import { ArcServer, Severity, denied } from '@cratis/arc.core';
import type { ExecutionContext, Outcome } from '@cratis/arc.core';
import type { IChronicleClient } from '@cratis/chronicle';
import type { AppendResult } from '@cratis/chronicle/eventSequences';
import { defineChronicleCommand } from '../../ChronicleCommand.js';

class Placed { constructor(readonly name: string) {} }

export class a_command_with_mutable_produced_values {
    append!: sinon.SinonStub;
    server!: ArcServer;
    context!: ExecutionContext;

    constructor() { this.reset(); }

    reset() {
        const occurred = new Date('2026-01-01T00:00:00.000Z');
        const tags = ['original-tag'];
        const entry = { eventSourceId: 'original', event: new Placed('first'), subject: 'original-subject', occurred, tags };
        const produced = { events: [entry], response: 'done' as string | Outcome<never> };
        const accepted: AppendResult = {
            sequenceNumber: { value: 1n, isBefore: other => 1n < other.value, isAfter: other => 1n > other.value, toString: () => '1' },
            constraintViolations: [], errors: [], isSuccess: true,
            waitForCompletion: async () => ({ isSuccess: true, failedPartitions: [] })
        };
        this.append = sinon.stub().resolves(accepted);
        const client = {
            getEventStore: async () => {
                entry.eventSourceId = 'changed';
                entry.subject = 'changed-subject';
                occurred.setUTCFullYear(2030);
                tags.push('changed-tag');
                produced.events.length = 0;
                produced.response = denied();
                return { eventTypes: { all: [Placed] }, eventLog: { append: this.append } };
            }
        } as unknown as IChronicleClient;
        const command = defineChronicleCommand({ name: 'Place', schema: z.object({}), client,
            eventStore: 'Tasks', namespaceForContext: () => 'tenant', produce: () => produced });
        this.context = { correlationId: crypto.randomUUID(), tenantId: 'tenant', principal: undefined,
            signal: new AbortController().signal, allowedSeverity: Severity.Warning };
        this.server = new ArcServer({ commands: [command] });
    }
}
