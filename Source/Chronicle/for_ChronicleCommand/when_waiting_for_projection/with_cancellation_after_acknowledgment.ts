// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer } from '@cratis/arc.core';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import { z } from 'zod';
import sinon from 'sinon';
import { defineChronicleCommand } from '../../ChronicleCommand.js';
import { accepted, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

describe('when a defined Chronicle command is canceled just after append acknowledgment', () => {
    it('should keep the successful response without waiting for observers', async () => {
        const abort = new AbortController();
        const completion = sinon.stub().resolves({ isSuccess: true, failedPartitions: [] });
        const append = sinon.stub().callsFake(async () => {
            abort.abort(new Error('request canceled'));
            return { ...accepted(), waitForCompletion: completion };
        });
        const store = { eventTypes: { all: [Placed] }, eventLog: { append } } as unknown as IEventStore;
        const client = { getEventStore: async () => store } as unknown as IChronicleClient;
        const definition = defineChronicleCommand({ name: 'PlaceWithWait', schema: z.object({}), client,
            eventStore: 'Work', namespaceForContext: () => 'Default', completionTimeoutMs: 3000,
            produce: () => ({ events: [{ eventSourceId: 'source-1', event: new Placed('Ada') }], response: 'done' }) });
        const server = new ArcServer({ commands: [definition] });
        try {
            const result = await server.executeCommand('PlaceWithWait', {}, { ...executionContext('Default'), signal: abort.signal });
            result.isSuccess.should.equal(true);
            result.response!.should.equal('done');
            append.calledOnce.should.equal(true);
            completion.notCalled.should.equal(true);
        } finally { await server.dispose(); }
    });
});
