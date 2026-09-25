// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { analyzeSource } from '../../analyzeSource.js';
import { renderSource } from '../../renderSource.js';

const root = resolve(import.meta.dirname, '../given/duplicate_project');
const artifacts = resolve(root, 'artifacts');

describe('when rendering duplicate model names from real classes', () => {
    let files: ReturnType<typeof renderSource>;
    beforeEach(() => {
        files = renderSource(analyzeSource(resolve(root, 'tsconfig.json'), artifacts, '', true), { jsImportSpecifiers: true });
    });
    it('should alias a model that collides with its containing class', () => {
        files.get('Orders/Item.ts')!.should.include('import { Item as Invoices_Item }');
        files.get('Orders/Item.ts')!.should.include('@field(Invoices_Item)');
    });
});
