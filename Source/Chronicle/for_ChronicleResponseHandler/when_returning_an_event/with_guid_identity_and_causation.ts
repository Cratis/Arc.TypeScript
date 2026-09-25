// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, DateOnly, TimeOnly, TimeSpan, Guid, field } from '@cratis/fundamentals';
import { subject } from '@cratis/chronicle/compliance';
import { eventType } from '@cratis/chronicle/events';
import type { IEventStore, IChronicleClient } from '@cratis/chronicle';
import { causationManager } from '@cratis/chronicle/auditing';
import { ArcApplication, command } from '@cratis/arc.core';
import sinon from 'sinon';
import { accepted } from '../../for_ChronicleCommand/given/a_command_with_typed_ports.js';
import { context } from '../given/a_registered_command.js';
import '../../index.js';

class GuidIdentity extends ConceptAs<Guid> { static readonly valueType = Guid; }
class Quantity extends ConceptAs<number> { static readonly valueType = Number; }
@eventType() class GuidEvent { @field(String) name = ''; }
@command() class WriteWithGuid {
    @field(Guid) sourceId = Guid.create();
    @subject() @field(GuidIdentity) owner = new GuidIdentity(Guid.create());
    @field(Quantity) quantity = new Quantity(3);
    @field(Date) occurred = new Date('2025-01-02T03:04:05.000Z');
    @field(DateOnly) day = DateOnly.from(2025, 1, 2);
    @field(TimeOnly) time = TimeOnly.parse('12:30:00');
    @field(TimeSpan) duration = TimeSpan.parse('01:30:00');
    getEventSourceId() { return this.sourceId; }
    handle() { return new GuidEvent(); }
}
@command() class WriteWithGuidSubject {
    @field(String) sourceId = '';
    @subject() @field(Guid) owner = Guid.create();
    getEventSourceId() { return this.sourceId; }
    handle() { return new GuidEvent(); }
}
@command() class WriteWithConceptId {
    @field(Guid) sourceId = Guid.create();
    getEventSourceId(): GuidIdentity { return new GuidIdentity(this.sourceId); }
    handle() { return new GuidEvent(); }
}

describe('when a Chronicle command carries Guid identities and concept values', () => {
    const appended = sinon.stub();
    let application: ArcApplication;
    beforeEach(async () => {
        appended.reset();
        appended.callsFake(async () => [accepted()]);
        const store = { eventTypes: { all: [GuidEvent] }, eventLog: { appendMany: appended } } as unknown as IEventStore;
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Subjects', client: { getEventStore: async () => store } as unknown as IChronicleClient });
        builder.add(WriteWithGuid, WriteWithGuidSubject, WriteWithConceptId, GuidEvent);
        application = await builder.build();
    });
    afterEach(async () => { await application?.dispose(); });
    it('should route a Guid event source and a Guid concept subject without dropping either', async () => {
        const sourceId = Guid.create();
        const owner = new GuidIdentity(Guid.create());
        const result = await application.server.executeCommand('WriteWithGuid', { sourceId: sourceId.toString(), owner: owner.toString(), quantity: 3,
            occurred: '2025-01-02T03:04:05.000Z', day: '2025-01-02', time: '12:30:00', duration: '01:30:00' }, context());
        result.isSuccess.should.equal(true, JSON.stringify(result));
        appended.firstCall.args[0][0].eventSourceId.should.equal(sourceId.toString());
        appended.firstCall.args[0][0].subject.should.equal(owner.toString());
    });
    it('should route a plain Guid subject', async () => {
        const owner = Guid.create();
        const result = await application.server.executeCommand('WriteWithGuidSubject',
            { sourceId: 'source-1', owner: owner.toString() }, context());
        result.isSuccess.should.equal(true, JSON.stringify(result));
        appended.firstCall.args[0][0].subject.should.equal(owner.toString());
    });
    it('should accept a Guid concept returned by getEventSourceId', async () => {
        const sourceId = Guid.create();
        const result = await application.server.executeCommand('WriteWithConceptId', { sourceId: sourceId.toString() }, context());
        result.isSuccess.should.equal(true, JSON.stringify(result));
        appended.firstCall.args[0][0].eventSourceId.should.equal(sourceId.toString());
    });
    it('should record non-sensitive concept and date values in the causation chain', async () => {
        const quantity = new Quantity(42);
        const occurred = new Date('2025-01-02T03:04:05.000Z');
        appended.callsFake(async () => {
            const properties = causationManager.getCurrentChain().find(item => item.type.name === 'Arc.Command')?.properties;
            properties!['Value.quantity']!.should.equal('42');
            properties!['Value.occurred']!.should.equal(occurred.toISOString());
            properties!['Value.day']!.should.equal('2025-01-02');
            properties!['Value.time']!.should.equal('12:30:00');
            properties!['Value.duration']!.should.equal('01:30:00');
            properties!['Value.sourceId']!.should.equal(sourceId.toString());
            properties!['Value.owner']!.should.match(/^[0-9a-f-]{36}$/);
            return [accepted()];
        });
        const sourceId = Guid.create();
        const result = await application.server.executeCommand('WriteWithGuid', { sourceId: sourceId.toString(), owner: Guid.create().toString(), quantity: quantity.value,
            occurred: occurred.toISOString(), day: '2025-01-02', time: '12:30:00', duration: '01:30:00' }, context());
        result.isSuccess.should.equal(true, JSON.stringify(result));
    });
});
