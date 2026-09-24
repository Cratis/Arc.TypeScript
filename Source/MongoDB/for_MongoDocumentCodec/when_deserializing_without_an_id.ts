// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { MongoDocumentCodec } from '../MongoDocumentCodec.js';
import { TaskItem } from './given/a_decorated_task.js';

should();
describe('when deserializing without an id', () => {
    let error: unknown;
    beforeEach(() => {
        try { new MongoDocumentCodec(TaskItem).deserialize({ name: 'review' }); }
        catch (failure) { error = failure; }
    });
    it('should fail rather than materializing a keyless read model', () => {
        String(error).should.contain('missing _id');
    });
});
