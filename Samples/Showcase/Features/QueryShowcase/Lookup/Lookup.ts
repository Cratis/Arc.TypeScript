// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { query, readModel } from '@cratis/arc.core';
import { ShowcaseCatalog } from '../ShowcaseCatalog.js';

/** The detail of one catalog row, fetched with query arguments. */
@readModel()
export class ShowcaseItemDetail {
    @field(Number) id!: number;
    @field(String) name!: string;
    @field(String) category!: string;
    @field(String) createdAt!: string;

    @query()
    static byId(id: number, catalog: ShowcaseCatalog): ShowcaseItemDetail | undefined {
        return catalog.entries.find(entry => entry.id === id);
    }

    @query()
    static byCategory(category: string, catalog: ShowcaseCatalog): ShowcaseItemDetail[] {
        return catalog.entries.filter(entry => entry.category === category);
    }
}
