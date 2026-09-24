// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readModel, query, QueryHttpMethod } from '@cratis/arc.core';

@readModel()
export class Item {
    /** Find an {@link Item}. */
    @query({ httpMethod: QueryHttpMethod.Query, treatWarningsAsErrors: true })
    static find(): Item { return new Item(); }
}
