// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { path, query, readModel, service } from '@cratis/arc.core';
import { mongoCollection, type MongoCollection } from '@cratis/arc.mongodb';
import { fromEvent } from '@cratis/chronicle/projections';
import { field } from '@cratis/fundamentals';
import type { Observable } from 'rxjs';
import { SomeId } from '../SomeId.js';
import { SomeName } from '../SomeName.js';
import { Registered } from '../Registration/Registration.js';

@readModel()
@fromEvent(Registered)
export class Listing {
    @field(SomeId) id!: SomeId;
    @field(SomeName) name!: SomeName;
}

// The template plan allows a separate query class to avoid Listing's decorator temporal dead zone.
@readModel()
export class ListingQueries {
    @path('/api/listings')
    @query({ observable: true }, service(mongoCollection(Listing)))
    static all(collection: MongoCollection<Listing>): Observable<Listing[]> {
        return collection.observe();
    }
}
