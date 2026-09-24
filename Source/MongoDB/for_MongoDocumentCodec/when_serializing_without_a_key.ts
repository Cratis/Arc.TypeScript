// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { MongoDocumentCodec } from '../MongoDocumentCodec.js';
import { TaskItem } from './given/a_decorated_task.js';

should();
describe('when serializing without a key', () => {
    let error: unknown;
    beforeEach(() => {
        try { new MongoDocumentCodec(TaskItem).serialize(new TaskItem()); }
        catch (failure) { error = failure; }
    });
    it('should refuse to let the driver invent an identity', () => {
        String(error).should.contain('requires a key value');
    });
});
