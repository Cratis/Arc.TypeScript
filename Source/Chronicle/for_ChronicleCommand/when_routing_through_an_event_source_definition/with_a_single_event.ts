// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer } from '@cratis/arc.core';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import sinon from 'sinon';
import { z } from 'zod';
import { defineChronicleCommand } from '../../ChronicleCommand.js';
import { given } from '../../given.js';
import { accepted, executionContext, Placed } from '../given/a_command_with_typed_ports.js';
import { Account } from '../../given/event_source_routing.js';

describe('when a defined command appends one event through an event source definition', given(class {}, () => {
    let options: { eventSource?: unknown; eventStream?: string; concurrencyScope?: unknown };
    beforeEach(async () => {
        const append = sinon.stub().resolves(accepted());
        const getEventStore = async () => ({ eventLog: { append }, eventTypes: { all: [Placed] }, eventSources: { getFor: () => ({ name: 'Account', streams: [{ name: 'Transactions' }] }) } }) as unknown as IEventStore;
        const command = defineChronicleCommand({ name: 'Place', schema: z.object({}), eventStore: 'Accounts',
            client: { getEventStore } as unknown as IChronicleClient, eventSource: { source: Account, stream: 'Transactions' },
            namespaceForContext: context => context.tenantId ?? '',
            produce: () => ({ events: [{ eventSourceId: 'a', event: new Placed('first') }], response: 'done' }) });
        const server = new ArcServer({ commands: [command] });
        const result = await server.executeCommand('Place', {}, executionContext('a'));
        result.isSuccess.should.equal(true, JSON.stringify(result));
        options = append.firstCall.args[2] as typeof options;
        await server.dispose();
    });
    it('should route the append through the definition and stream', () => {
        options.eventSource!.should.equal(Account);
        options.eventStream!.should.equal('Transactions');
    });
    it('should leave the concurrency scope to the definition', () => (options.concurrencyScope === undefined).should.equal(true));
}));
