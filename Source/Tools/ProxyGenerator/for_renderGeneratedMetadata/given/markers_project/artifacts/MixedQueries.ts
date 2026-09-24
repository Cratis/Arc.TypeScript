// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DateOnly, Guid, field } from '@cratis/fundamentals';
import { query, readModel } from '@cratis/arc.core';
import { Prepared } from './Prepared.js';

@readModel()
export class MixedQueries {
    @field(String) name!: string;
    @query() static by_id(id: Guid, day: DateOnly, maybe?: Prepared): MixedQueries | null {
        void id; void day; void maybe;
        return null;
    }
    @query() static byIdA(): MixedQueries[] { return []; }
}
