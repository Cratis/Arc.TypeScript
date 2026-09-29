// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { TaskRecord } from '../../for_MongoCollection/given/TaskRecord.js';
import { camelCaseMongoNamingPolicy } from '../../MongoNamingPolicy.js';
import { resolveMongoCollectionName } from '../../resolveMongoCollectionName.js';

should();
describe('when resolving a collection name with an override and a naming policy', () => {
    const name = resolveMongoCollectionName({ namingPolicy: camelCaseMongoNamingPolicy, collectionName: type => type.name }, TaskRecord);
    it('should prefer the override', () => name.should.equal('TaskRecord'));
});
