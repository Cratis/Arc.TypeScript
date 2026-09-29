// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { WithId } from 'mongodb';
import { MongoReadModels } from '../../MongoReadModels.js';
import { a_tenant_collection, type Task } from './a_tenant_collection.js';

export class Person { name = ''; }

/** The same collection, declared as holding raw Person documents keyed by a string subject. */
export class a_typed_tenant_collection extends a_tenant_collection {
    readonly typed: MongoReadModels<Task, string>;
    constructor() {
        super();
        this.toArray.callsFake(async () => [{ ...this.doc, _id: 'subject-1' }]);
        this.findOne.callsFake(async () => ({ ...this.doc, _id: 'subject-1' }));
        this.typed = new MongoReadModels<Task, string>({ client: this.client, databaseForTenant: tenant => `app_${tenant}`,
            filterFor: this.filterFor, readModel: Person }, 'people');
    }
    withSubject(subjectFor: (document: WithId<Task>) => string): MongoReadModels<Task, string> {
        return new MongoReadModels<Task, string>({ client: this.client, databaseForTenant: tenant => `app_${tenant}`,
            filterFor: this.filterFor, readModel: Person, subjectFor }, 'people');
    }
}
