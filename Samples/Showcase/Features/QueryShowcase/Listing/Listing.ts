// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { query, readModel } from '@cratis/arc.core';
import { ShowcaseCatalog } from '../ShowcaseCatalog.js';

/** A catalog row. Arrays are sorted and paged by Arc from `sortBy`, `sortDirection`, `page` and `pageSize`. */
@readModel()
export class ShowcaseItem {
    @field(Number) id!: number;
    @field(String) name!: string;
    @field(String) category!: string;
    @field(String) createdAt!: string;

    @query()
    static all(catalog: ShowcaseCatalog): ShowcaseItem[] { return [...catalog.entries]; }

    @query()
    static latest(catalog: ShowcaseCatalog): ShowcaseItem[] { return catalog.entries.slice(-5).reverse(); }
}
