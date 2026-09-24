// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { getEventTypeMetadata } from '@cratis/chronicle/events';
import { EventSequenceNumber } from '@cratis/chronicle/eventSequences';
import { ArcApplication, command, inject, key } from '@cratis/arc.core';
import { AggregateRoot, commandAggregate } from '../../index.js';
import { given } from '../../given.js';
import { Created, a_registered_command, context } from '../../for_ChronicleResponseHandler/given/a_registered_command.js';

class Counter extends AggregateRoot {
    count = 0;
    onCreated(event: Created): void { void event; this.count++; }
}
@command() class AddCount {
    @field(String) @key() id = '';
    @inject(commandAggregate(Counter))
    handle(counter: Counter) {
        counter.apply(new Created());
        return counter.commit();
    }
}

describe('when a command uses a rehydrated aggregate', given(a_registered_command, setup => {
    beforeEach(() => { setup.appendMany.resetHistory(); });
    it('should replay its event source and commit only newly applied events', async () => {
        const store = await setup.getEventStore();
        const metadata = getEventTypeMetadata(Created)!.eventType;
        const getForEventSourceIdAndEventTypes = async (id: string) => {
            id.should.equal('counter-1');
            return [{ eventType: metadata, content: { name: 'previous' }, context: { sequenceNumber: 9n } }];
        };
        setup.getEventStore.resolves({ ...store, eventLog: { ...store.eventLog, getForEventSourceIdAndEventTypes } });
        const builder = ArcApplication.createBuilder();
        builder.addChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
        builder.add(AddCount, Created);
        const app = await builder.build();
        try {
            const result = await app.server.executeCommand('AddCount', { id: 'counter-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            setup.appendMany.calledOnce.should.equal(true);
            setup.appendMany.firstCall.args[0].should.have.lengthOf(1);
            setup.appendMany.firstCall.args[1].concurrencyScopes['counter-1'].sequenceNumber.should.equal(9n);
        } finally { await app.dispose(); }
    });
    it('should start a new source with a before-first concurrency scope', async () => {
        const store = await setup.getEventStore();
        setup.getEventStore.resolves({ ...store, eventLog: { ...store.eventLog,
            getForEventSourceIdAndEventTypes: async () => [] } });
        const builder = ArcApplication.createBuilder();
        builder.addChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
        builder.add(AddCount, Created);
        const app = await builder.build();
        try {
            const result = await app.server.executeCommand('AddCount', { id: 'counter-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            setup.appendMany.firstCall.args[1].concurrencyScopes['counter-1'].sequenceNumber.should.equal(EventSequenceNumber.beforeFirst.value);
        } finally { await app.dispose(); }
    });
    it('should not append when rehydration fails', async () => {
        const store = await setup.getEventStore();
        setup.getEventStore.resolves({ ...store, eventLog: { ...store.eventLog,
            getForEventSourceIdAndEventTypes: async () => { throw new Error('read unavailable'); } } });
        const builder = ArcApplication.createBuilder();
        builder.addChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
        builder.add(AddCount, Created);
        const app = await builder.build();
        try {
            const result = await app.server.executeCommand('AddCount', { id: 'counter-1' }, context());
            result.isSuccess.should.equal(false);
            setup.appendMany.called.should.equal(false);
        } finally { await app.dispose(); }
    });
}));
