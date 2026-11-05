// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** A row of the demonstration catalog. */
export interface CatalogEntry {
    readonly id: number;
    readonly name: string;
    readonly category: string;
    readonly createdAt: string;
}

/** Demonstration-only in-memory catalog shared by the listing and lookup slices. */
export class ShowcaseCatalog {
    readonly entries: readonly CatalogEntry[];

    constructor(size = 40) {
        const categories = ['Books', 'Games', 'Music', 'Tools'];
        const start = Date.parse('2025-01-01T00:00:00Z');
        this.entries = Array.from({ length: size }, (_, index) => ({
            id: index + 1,
            name: `Item ${String(index + 1).padStart(2, '0')}`,
            category: categories[index % categories.length] ?? 'Books',
            createdAt: new Date(start + index * 86_400_000).toISOString()
        }));
    }
}
