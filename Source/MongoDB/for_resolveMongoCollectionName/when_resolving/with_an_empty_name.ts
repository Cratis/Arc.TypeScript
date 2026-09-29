// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { TaskRecord } from '../../for_MongoCollection/given/TaskRecord.js';
import { resolveMongoCollectionName } from '../../resolveMongoCollectionName.js';

should();
describe('when resolving a collection name and the override returns an empty name', () => {
    let failure: Error | undefined;
    try { resolveMongoCollectionName({ collectionName: () => '' }, TaskRecord); }
    catch (error) { failure = error as Error; }
    it('should fail instead of choosing a collection', () => failure!.message.should.equal('MongoDB collection name is required'));
});
