// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { MongoDocumentCodec } from '../MongoDocumentCodec.js';
import { TaskItem } from './given/a_decorated_task.js';

should();
describe('when encoding an object identity', () => {
    let error: unknown;
    beforeEach(() => {
        try { new MongoDocumentCodec(TaskItem).id({ $ne: null }); }
        catch (failure) { error = failure; }
    });
    it('should reject the caller-supplied filter operator', () => {
        String(error).should.contain('identity must be a primitive');
    });
});
