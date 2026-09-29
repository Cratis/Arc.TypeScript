// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { MongoClient } from 'mongodb';
import type { Collection, Db, Document } from 'mongodb';
import { MongoReadModels } from '../../MongoDB/MongoReadModels.js';
import { a_projection } from './a_projection.js';

/**
 * Raw MongoDB documents of the protected PrivateView, shaped as Chronicle's MongoDB sink stores them: the key as
 * `_id`, the encrypted field, and the kernel's bookkeeping (WellKnownProperties.All, minus an empty `__subjects`).
 */
export class raw_mongo_documents extends a_projection {
    document: Document = { _id: 'subject-1', name: 'ciphertext', __lastHandledEventSequenceNumber: 7,
        __initialized: true, __subject: 'subject-1' };
    readonly client = new MongoClient('mongodb://localhost:27017');
    readonly toArray = sinon.stub().callsFake(async () => [{ ...this.document }]);
    readonly collection = {
        find: () => ({ toArray: this.toArray, skip: () => ({ limit: () => ({ toArray: this.toArray }) }) }),
        findOne: async () => ({ ...this.document }),
        countDocuments: async () => 1
    } as unknown as Collection<Document>;
    readonly mongo: MongoReadModels<Document, object>;

    constructor() {
        super();
        sinon.stub(this.client, 'db').returns({ collection: () => this.collection } as unknown as Db);
        this.mongo = new MongoReadModels<Document, object>({ client: this.client, databaseForTenant: tenant => tenant,
            filterFor: () => ({}), readModel: this.model }, 'privateViews');
    }
    withSubject(subjectFor: (document: Document) => string): MongoReadModels<Document, object> {
        return new MongoReadModels<Document, object>({ client: this.client, databaseForTenant: tenant => tenant,
            filterFor: () => ({}), readModel: this.model, subjectFor }, 'privateViews');
    }
}
