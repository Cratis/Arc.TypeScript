// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { argument } from '../../../queries/modelBound/argument.js';
import { query } from '../../../queries/modelBound/query.js';
import { readModel } from '../../../queries/modelBound/readModel.js';
import { Name } from './Name.js';
import { SearchArguments } from './SearchArguments.js';
@readModel()
export class Search {
    @query({ argumentsModel: SearchArguments }, argument('term', Name))
    static byTerm(term: Name): string { return term.value; }
}
