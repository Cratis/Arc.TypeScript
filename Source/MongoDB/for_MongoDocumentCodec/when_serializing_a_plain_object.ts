// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { Guid } from '@cratis/fundamentals';
import { MongoDocumentCodec } from '../MongoDocumentCodec.js';
import { TaskItem } from './given/a_decorated_task.js';
import { TaskName } from './given/TaskName.js';

should();
describe('when serializing a plain object typed as a MongoDB model', () => {
    it('should encode declared fields and the key rather than an empty document', () => {
        const codec = new MongoDocumentCodec(TaskItem);
        const id = Guid.parse('00112233-4455-6677-8899-aabbccddeeff');
        const document = codec.serialize({ id, name: new TaskName('review') } as TaskItem);
        Object.hasOwn(document, '_id').should.equal(true);
        document.name.should.equal('review');
    });
    it('should reject a plain object missing its key', () => {
        const codec = new MongoDocumentCodec(TaskItem);
        (() => codec.serialize({ name: new TaskName('review') } as TaskItem)).should.throw('requires a key value');
    });
});
