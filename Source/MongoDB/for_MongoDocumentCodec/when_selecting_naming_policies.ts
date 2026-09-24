// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { field, Guid } from '@cratis/fundamentals';
import { key } from '@cratis/arc.core';
import { camelCaseMongoNamingPolicy, defaultMongoNamingPolicy } from '../MongoNamingPolicy.js';
import { MongoDocumentCodec } from '../MongoDocumentCodec.js';

should();
class TaskRecord { @field(Guid) @key() Id!: Guid; @field(String) Title!: string; }
class Category { @field(Guid) @key() Id!: Guid; @field(String) URL!: string; }

describe('when selecting MongoDB naming policies', () => {
    it('should match default Arc .NET names for fields and plural collections', () => {
        const codec = new MongoDocumentCodec(TaskRecord);
        codec.fieldName('Title').should.equal('Title');
        defaultMongoNamingPolicy.collectionName(TaskRecord).should.equal('TaskRecords');
        defaultMongoNamingPolicy.collectionName(Category).should.equal('Categories');
    });
    it('should match Arc .NET camel-case names while retaining leading acronyms', () => {
        const codec = new MongoDocumentCodec(Category, false, camelCaseMongoNamingPolicy);
        codec.fieldName('URL').should.equal('URL');
        camelCaseMongoNamingPolicy.collectionName(TaskRecord).should.equal('taskRecords');
        camelCaseMongoNamingPolicy.collectionName(Category).should.equal('categories');
    });
});
