// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { MongoClient, ObjectId } from 'mongodb';
import type { Collection, Db } from 'mongodb';
import type { ExecutionContext } from '@cratis/arc.core';
import { MongoReadModels } from '../../MongoReadModels.js';

export interface Task { _id: ObjectId; title: string; status: string; owner: string }
export const executionContext = (tenantId?: string, signal = new AbortController().signal): ExecutionContext =>
    ({ tenantId, correlationId: crypto.randomUUID(), principal: undefined, signal, allowedSeverity: 3 });

export class a_tenant_collection {
    client = new MongoClient('mongodb://localhost:27017');
    doc: Task = { _id: new ObjectId(), title: 'first', status: 'open', owner: 'alice' };
    toArray = sinon.stub().resolves([this.doc]);
    limit = sinon.stub().returns({ toArray: this.toArray });
    skip = sinon.stub().returns({ limit: this.limit });
    find = sinon.stub().returns({ toArray: this.toArray, skip: this.skip });
    findOne = sinon.stub().resolves(this.doc);
    countDocuments = sinon.stub().resolves(3);
    collection = { find: this.find, findOne: this.findOne, countDocuments: this.countDocuments } as unknown as Collection<Task>;
    db = sinon.stub(this.client, 'db').returns({ collection: () => this.collection } as unknown as Db);
    filterFor = sinon.stub().callsFake((owner: string) => ({ owner }));
    models: MongoReadModels<Task, string>;

    constructor() {
        this.models = new MongoReadModels<Task, string>({ client: this.client, databaseForTenant: tenant => `app_${tenant}`, filterFor: this.filterFor }, 'tasks');
    }
}
