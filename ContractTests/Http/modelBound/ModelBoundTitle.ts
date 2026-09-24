// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { allowAnonymous, argument, query, readModel, route } from '@cratis/arc.core';

@readModel({ namespace: 'HttpFixture' })
export class ModelBoundTitle {
    @field(String) title!: string;

    @allowAnonymous()
    @route('/api/model-bound-title')
    @query(argument('title', String))
    static Get(title: string): ModelBoundTitle { return Object.assign(new ModelBoundTitle(), { title }); }
}
