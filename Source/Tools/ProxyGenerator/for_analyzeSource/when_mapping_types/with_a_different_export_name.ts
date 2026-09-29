// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { analyzeSource } from '../../analyzeSource.js';
import { renderSource } from '../../renderSource.js';

const root = resolve(import.meta.dirname, '../given/mapped_project');

describe('when mapping a type to a package export with another name', () => {
    let files: ReturnType<typeof renderSource>;
    beforeEach(() => {
        files = renderSource(analyzeSource(resolve(root, 'tsconfig.json'), resolve(root, 'artifacts'), '', true, undefined, undefined, undefined,
            { 'Shared.Money': { package: '@acme/money', export: 'Price' } }));
    });
    it('should import and use the exported name', () => {
        files.get('Orders/PlaceOrder.ts')!.should.include("import { Price } from '@acme/money';")
            .and.include("new PropertyDescriptor('price', Price, false)");
    });
    it('should still generate the unmapped types', () => {
        [...files.keys()].should.include.members(['Shared/Entity.ts', 'Shared/Currency.ts']).and.not.include('Shared/Money.ts');
    });
});
