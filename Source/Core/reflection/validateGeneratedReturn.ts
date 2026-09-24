// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { isQueryPage } from '../queries/QueryPage.js';
import type { GeneratedReturn } from './GeneratedReturn.js';

/** @internal Check that the executed result matches the source-declared cardinality. */
export function validateGeneratedReturn(name: string, declaration: GeneratedReturn | undefined, value: unknown): void {
    if (!declaration) return;
    if (value === null || value === undefined) {
        if (declaration.cardinality === 'void' || declaration.nullable) return;
        throw new Error(`${name} returned no value; generated metadata declares ${declaration.cardinality}`);
    }
    const valid = declaration.cardinality === 'void' ? false : declaration.cardinality === 'many' ? Array.isArray(value) :
        declaration.cardinality === 'paged' ? isQueryPage(value) : !Array.isArray(value) && !isQueryPage(value);
    if (!valid) throw new Error(`${name} returned the wrong cardinality; generated metadata declares ${declaration.cardinality}`);
}
