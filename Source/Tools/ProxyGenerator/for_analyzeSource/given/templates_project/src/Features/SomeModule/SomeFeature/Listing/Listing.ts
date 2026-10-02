// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { path, query, readModel, service } from '@cratis/arc.core';
import { ChronicleReadModels } from '@cratis/arc.chronicle';
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

    @path('/api/listings')
    @query({ observable: true }, service(ChronicleReadModels))
    static all(models: ChronicleReadModels): Observable<Listing[]> {
        return models.observeAll(Listing, listing => listing.id.toString());
    }
}
