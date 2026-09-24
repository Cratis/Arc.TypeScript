// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { DateOnly, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import { given } from '../../given.js';
import { MongoDocumentCodec } from '../../MongoDocumentCodec.js';
import { a_replica_set } from '../../for_MongoCollection/given/a_replica_set.js';
import { TaskItem } from '../given/a_decorated_task.js';
import { SpecialTask } from '../given/SpecialTask.js';
import { TaskName } from '../given/TaskName.js';
import { TaskDetails } from '../given/TaskDetails.js';

should();
describe('when round tripping a model with a replica set', given(a_replica_set, context => {
    let restored: TaskItem;
    beforeEach(async () => {
        if (!process.env.ARC_MONGO_TEST_URI) throw new Error('ARC_MONGO_TEST_URI is required');
        await context.client.connect();
        const codec = new MongoDocumentCodec(TaskItem);
        const task = Object.assign(new SpecialTask(), {
            id: Guid.parse('00112233-4455-6677-8899-aabbccddeeff'),
            name: new TaskName('review'), due: DateOnly.parse('2026-05-12'),
            time: TimeOnly.parse('12:30:45.123'), elapsed: TimeSpan.parse('01:02:03'),
            created: new Date('2026-05-12T00:00:00Z'),
            details: [Object.assign(new TaskDetails(), { label: 'first' })], extra: 'special'
        });
        const collection = context.client.db(context.name).collection('tasks');
        await collection.insertOne(codec.serialize(task));
        const stored = await collection.findOne({ _id: codec.id(task.id) } as Parameters<typeof collection.findOne>[0]);
        if (!stored) throw new Error('MongoDB did not return the inserted model');
        restored = codec.deserialize(stored);
    });
    afterEach(async () => {
        try { await context.client.db(context.name).dropDatabase(); }
        finally { await context.client.close(); }
    });
    it('should restore typed values and the derived model from BSON', () => {
        restored.should.be.instanceOf(SpecialTask);
        restored.id.toString().should.equal('00112233-4455-6677-8899-aabbccddeeff');
        restored.name.value.should.equal('review');
        restored.due.toString().should.equal('2026-05-12');
        restored.time.toString().should.equal('12:30:45.123');
        restored.elapsed.toString().should.equal('01:02:03');
        restored.created.toISOString().should.equal('2026-05-12T00:00:00.000Z');
        restored.details[0]!.label.should.equal('first');
        (restored as SpecialTask).extra.should.equal('special');
    });
}));
