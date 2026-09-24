// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field, Guid } from '@cratis/fundamentals';
import { allowAnonymous, argument, query, readModel } from '@cratis/arc.core';

/** A lookup with a conventional model-bound route. */
@readModel({ namespace: 'HttpFixture' })
export class ModelBoundLookup {
    @field(String) value!: string;

    @allowAnonymous()
    @query(argument('id', Guid))
    static ById(id: Guid): ModelBoundLookup { return Object.assign(new ModelBoundLookup(), { value: id.toString() }); }
}
