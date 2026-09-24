// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { Binary } from 'mongodb';
import { DateOnly, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import { MongoDocumentCodec } from '../MongoDocumentCodec.js';
import { TaskItem } from './given/a_decorated_task.js';
import { SpecialTask } from './given/SpecialTask.js';
import { TaskName } from './given/TaskName.js';
import { TaskDetails } from './given/TaskDetails.js';

should();
describe('when round tripping a derived MongoDB model', () => {
    let document: ReturnType<MongoDocumentCodec<TaskItem>['serialize']>;
    let restored: TaskItem;
    beforeEach(() => {
        const task = Object.assign(new SpecialTask(), {
            id: Guid.parse('00112233-4455-6677-8899-aabbccddeeff'), name: new TaskName('review'),
            due: DateOnly.parse('2026-05-12'), time: TimeOnly.parse('12:30:45'),
            elapsed: TimeSpan.parse('01:02:03'), created: new Date('2026-05-12T00:00:00Z'),
            details: [Object.assign(new TaskDetails(), { label: 'first' })], extra: 'special'
        });
        const codec = new MongoDocumentCodec(TaskItem);
        document = codec.serialize(task);
        restored = codec.deserialize(document);
    });
    it('should store the identity as a standard UUID binary', () => {
        (document._id as Binary).sub_type.should.equal(Binary.SUBTYPE_UUID);
        Buffer.from((document._id as Binary).buffer).toString('hex').should.equal('00112233445566778899aabbccddeeff');
    });
    it('should restore concepts, dates, nested fields and the derived type', () => {
        restored.should.be.instanceOf(SpecialTask);
        restored.id.toString().should.equal('00112233-4455-6677-8899-aabbccddeeff');
        restored.name.should.be.instanceOf(TaskName);
        restored.name.value.should.equal('review');
        restored.due.toString().should.equal('2026-05-12');
        restored.time.toString().should.equal('12:30:45');
        restored.elapsed.toString().should.equal('01:02:03');
        restored.created.toISOString().should.equal('2026-05-12T00:00:00.000Z');
        restored.details[0]!.label.should.equal('first');
        (restored as SpecialTask).extra.should.equal('special');
    });
});
