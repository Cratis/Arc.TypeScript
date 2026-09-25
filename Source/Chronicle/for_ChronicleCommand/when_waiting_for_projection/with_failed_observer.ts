// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer } from '@cratis/arc.core';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import { z } from 'zod';
import sinon from 'sinon';
import { defineChronicleCommand } from '../../ChronicleCommand.js';
import { accepted, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

describe('when a defined Chronicle command waits for an observer', () => {
    it('should not report success when the append committed but the observer failed', async () => {
        const completion = sinon.stub().resolves({ isSuccess: false, failedPartitions: [{}] });
        const store = { eventTypes: { all: [Placed] }, eventLog: { append: async () => ({
            ...accepted(), waitForCompletion: completion
        }) } } as unknown as IEventStore;
        const client = { getEventStore: async () => store } as unknown as IChronicleClient;
        const definition = defineChronicleCommand({ name: 'PlaceWithWait', schema: z.object({}), client,
            eventStore: 'Work', namespaceForContext: () => 'Default', completionTimeoutMs: 3000,
            produce: () => ({ events: [{ eventSourceId: 'source-1', event: new Placed('Ada') }] }) });
        const server = new ArcServer({ commands: [definition] });
        const result = await server.executeCommand('PlaceWithWait', {}, executionContext('Default'));
        result.isSuccess.should.equal(false);
        result.hasExceptions.should.equal(true);
        result.exceptionMessages[0]!.should.contain('append committed, but observer completion failed');
        completion.calledOnceWithExactly(3000).should.equal(true);
    });
});
