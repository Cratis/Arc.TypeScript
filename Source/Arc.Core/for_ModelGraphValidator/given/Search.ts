// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { argument, query, readModel } from '../../modelBound/decorators.js';
import { Name } from './Name.js';
import { SearchArguments } from './SearchArguments.js';
@readModel()
export class Search {
    @query({ argumentsModel: SearchArguments }, argument('term', Name))
    static byTerm(term: Name): string { return term.value; }
}
