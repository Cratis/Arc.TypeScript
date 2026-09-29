// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { TaskRecord } from '../../for_MongoCollection/given/TaskRecord.js';
import { resolveMongoCollectionName } from '../../resolveMongoCollectionName.js';

should();
describe('when resolving a collection name without options', () => {
    const name = resolveMongoCollectionName({}, TaskRecord);
    it('should pluralize the class name as the default policy does', () => name.should.equal('TaskRecords'));
});
