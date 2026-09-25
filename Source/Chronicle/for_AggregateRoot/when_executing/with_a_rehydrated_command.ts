// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType, getEventTypeMetadata } from '@cratis/chronicle/events';
import { EventSequenceNumber } from '@cratis/chronicle/eventSequences';
import { ArcApplication, CommandOperation, command, inject, key, tuple } from '@cratis/arc.core';
import { AggregateRoot, commandAggregate, eventSourceType, eventStreamType, eventStreamId } from '../../index.js';
import { given } from '../../given.js';
import { Created, a_registered_command, context } from '../../for_ChronicleResponseHandler/given/a_registered_command.js';

class Counter extends AggregateRoot {
    count = 0;
    replayedSequence?: bigint;
    constructor() { super(); this.on(Created, (event, context) => {
        if (!(event instanceof Created)) throw new Error('Expected a class instance');
        this.count++;
        this.replayedSequence = context?.sequenceNumber;
    }); }
}
@eventType() class Unhandled { @field(String) name = ''; }
class Stateless extends AggregateRoot { get fresh(): boolean { return this.isNew; } }
@command() class CheckSource {
    @field(String) @key() id = '';
    @inject(commandAggregate(Stateless))
    handle(aggregate: Stateless) { return aggregate.fresh; }
}
@command() class CheckReplayContext {
    @field(String) @key() id = '';
    @inject(commandAggregate(Counter))
    handle(aggregate: Counter) { return aggregate.replayedSequence?.toString(); }
}
class BrokenOperation extends CommandOperation {
    execute(): void { throw new Error('operation unavailable'); }
    compensate(): void {}
}
@command() class AddWithBrokenOperation {
    @field(String) @key() id = '';
    @inject(commandAggregate(Counter))
    handle(counter: Counter) { counter.apply(new Created()); return tuple(counter.commit(), new BrokenOperation()); }
}
@command() class AddAfterCommit {
    @field(String) @key() id = '';
    @inject(commandAggregate(Counter))
    handle(counter: Counter) { counter.apply(new Created()); counter.commit(); counter.apply(new Created()); }
}
@command() class AddWithoutCommit {
    @field(String) @key() id = '';
    @inject(commandAggregate(Counter))
    handle(counter: Counter) { counter.apply(new Created()); }
}
@command() class AddDiscardedCommit {
    @field(String) @key() id = '';
    @inject(commandAggregate(Counter))
    handle(counter: Counter) { counter.apply(new Created()); counter.commit(); }
}
@command() class AddStateless {
    @field(String) @key() id = '';
    @inject(commandAggregate(Stateless))
    handle(aggregate: Stateless) { aggregate.apply(new Created()); }
}
@command() class AddTwoAggregates {
    @field(String) @key() id = '';
    @inject(commandAggregate(Counter), commandAggregate(Stateless))
    handle(counter: Counter, stateless: Stateless) { counter.apply(new Created()); stateless.apply(new Created()); }
}
@eventSourceType('orders', { concurrency: true })
@eventStreamType('active', { concurrency: true })
@eventStreamId('one', { concurrency: true })
@command() class AddRoutedCount {
    @field(String) @key() id = '';
    @inject(commandAggregate(Counter))
    handle(counter: Counter) { counter.apply(new Created()); }
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
        setup.getEventStore.resolves({ ...store, eventLog: { ...store.eventLog, getForEventSourceIdAndEventTypes,
            getTailSequenceNumber: async () => new EventSequenceNumber(9n) } });
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
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
            getForEventSourceIdAndEventTypes: async () => [],
            getTailSequenceNumber: async () => EventSequenceNumber.beforeFirst } });
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
        builder.add(AddCount, Created);
        const app = await builder.build();
        try {
            const result = await app.server.executeCommand('AddCount', { id: 'counter-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            setup.appendMany.firstCall.args[1].concurrencyScopes['counter-1'].sequenceNumber.should.equal(EventSequenceNumber.beforeFirst.value);
        } finally { await app.dispose(); }
    });
    it('should use the unfiltered tail when an unhandled event follows a handled event', async () => {
        const store = await setup.getEventStore();
        const metadata = getEventTypeMetadata(Created)!.eventType;
        setup.getEventStore.resolves({ ...store, eventLog: { ...store.eventLog,
            getTailSequenceNumber: async () => new EventSequenceNumber(12n),
            getForEventSourceIdAndEventTypes: async () => [{ eventType: metadata, content: {}, context: { sequenceNumber: 9n } }] } });
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
        builder.add(AddCount, Created, Unhandled);
        const app = await builder.build();
        try {
            const result = await app.server.executeCommand('AddCount', { id: 'counter-1' }, context());
            result.isSuccess.should.equal(true);
            setup.appendMany.firstCall.args[1].concurrencyScopes['counter-1'].sequenceNumber.should.equal(12n);
        } finally { await app.dispose(); }
    });
    it('should use the append route for history, tail, and concurrency', async () => {
        const store = await setup.getEventStore();
        const tails: unknown[][] = [];
        const reads: unknown[][] = [];
        setup.getEventStore.resolves({ ...store, eventLog: { ...store.eventLog,
            getTailSequenceNumber: async (...args: unknown[]) => { tails.push(args); return new EventSequenceNumber(15n); },
            getForEventSourceIdAndEventTypes: async (...args: unknown[]) => { reads.push(args); return []; } } });
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
        builder.add(AddRoutedCount, Created);
        const app = await builder.build();
        try {
            const result = await app.server.executeCommand('AddRoutedCount', { id: 'counter-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            tails.should.deep.equal([['counter-1', 'orders', 'active', 'one']]);
            reads[0]!.slice(2).should.deep.equal(['active', 'one', 'orders']);
            const entry = setup.appendMany.firstCall.args[0][0];
            [entry.eventSourceType, entry.eventStreamType, entry.eventStreamId].should.deep.equal(['orders', 'active', 'one']);
            const scope = setup.appendMany.firstCall.args[1].concurrencyScopes['counter-1'];
            [scope.eventSourceType, scope.eventStreamType, scope.eventStreamId, scope.sequenceNumber].should.deep.equal(['orders', 'active', 'one', 15n]);
        } finally { await app.dispose(); }
    });
    it('should mark a source with only unhandled events as existing without reading history', async () => {
        const store = await setup.getEventStore();
        let read = false;
        setup.getEventStore.resolves({ ...store, eventLog: { ...store.eventLog,
            getTailSequenceNumber: async () => new EventSequenceNumber(8n),
            getForEventSourceIdAndEventTypes: async () => { read = true; return []; } } });
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
        builder.add(CheckSource, Created, Unhandled);
        const app = await builder.build();
        try {
            const result = await app.server.executeCommand('CheckSource', { id: 'counter-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            (result.response as boolean).should.equal(false);
            read.should.equal(false);
        } finally { await app.dispose(); }
    });
    it('should replay class instances with their stored event context', async () => {
        const store = await setup.getEventStore();
        const metadata = getEventTypeMetadata(Created)!.eventType;
        setup.getEventStore.resolves({ ...store, eventLog: { ...store.eventLog,
            getTailSequenceNumber: async () => new EventSequenceNumber(9n),
            getForEventSourceIdAndEventTypes: async () => [{ eventType: metadata, content: {}, context: { sequenceNumber: 9n } }] } });
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
        builder.add(CheckReplayContext, Created);
        const app = await builder.build();
        try {
            const result = await app.server.executeCommand('CheckReplayContext', { id: 'counter-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            (result.response as string).should.equal('9');
        } finally { await app.dispose(); }
    });
    it('should enroll applied events even when commit is not returned', async () => {
        const store = await setup.getEventStore();
        setup.getEventStore.resolves({ ...store, eventLog: { ...store.eventLog,
            getTailSequenceNumber: async () => EventSequenceNumber.beforeFirst,
            getForEventSourceIdAndEventTypes: async () => [] } });
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
        builder.add(AddWithoutCommit, AddDiscardedCommit, AddStateless, AddTwoAggregates, AddAfterCommit, Created);
        const app = await builder.build();
        try {
            for (const name of ['AddWithoutCommit', 'AddDiscardedCommit', 'AddStateless', 'AddTwoAggregates', 'AddAfterCommit']) {
                setup.appendMany.resetHistory();
                const result = await app.server.executeCommand(name, { id: 'counter-1' }, context());
                result.isSuccess.should.equal(true, JSON.stringify(result));
                setup.appendMany.calledOnce.should.equal(true);
                setup.appendMany.firstCall.args[0].should.have.lengthOf(['AddTwoAggregates', 'AddAfterCommit'].includes(name) ? 2 : 1);
            }
        } finally { await app.dispose(); }
    });
    it('should not append after a command operation fails', async () => {
        const store = await setup.getEventStore();
        setup.getEventStore.resolves({ ...store, eventLog: { ...store.eventLog,
            getTailSequenceNumber: async () => EventSequenceNumber.beforeFirst,
            getForEventSourceIdAndEventTypes: async () => [] } });
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
        builder.add(AddWithBrokenOperation, Created);
        const app = await builder.build();
        try {
            const result = await app.server.executeCommand('AddWithBrokenOperation', { id: 'counter-1' }, context());
            result.isSuccess.should.equal(false);
            setup.appendMany.called.should.equal(false);
        } finally { await app.dispose(); }
    });
    it('should fail closed when appendMany throws', async () => {
        const store = await setup.getEventStore();
        setup.appendMany.rejects(new Error('transport lost'));
        setup.getEventStore.resolves({ ...store, eventLog: { ...store.eventLog,
            getTailSequenceNumber: async () => EventSequenceNumber.beforeFirst,
            getForEventSourceIdAndEventTypes: async () => [] } });
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
        builder.add(AddWithoutCommit, Created);
        const app = await builder.build();
        try {
            const result = await app.server.executeCommand('AddWithoutCommit', { id: 'counter-1' }, context());
            result.isSuccess.should.equal(false);
            result.exceptionMessages.join(' ').should.contain('transport lost');
            setup.appendMany.calledOnce.should.equal(true);
        } finally { await app.dispose(); }
    });
    it('should not append when rehydration fails', async () => {
        const store = await setup.getEventStore();
        setup.getEventStore.resolves({ ...store, eventLog: { ...store.eventLog,
            getForEventSourceIdAndEventTypes: async () => { throw new Error('read unavailable'); },
            getTailSequenceNumber: async () => new EventSequenceNumber(9n) } });
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Tasks', client: { getEventStore: setup.getEventStore } as never });
        builder.add(AddCount, Created);
        const app = await builder.build();
        try {
            const result = await app.server.executeCommand('AddCount', { id: 'counter-1' }, context());
            result.isSuccess.should.equal(false);
            setup.appendMany.called.should.equal(false);
        } finally { await app.dispose(); }
    });
}));
