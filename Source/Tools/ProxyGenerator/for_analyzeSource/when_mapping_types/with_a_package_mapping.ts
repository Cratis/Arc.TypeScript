// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { analyzeSource } from '../../analyzeSource.js';
import { renderSource } from '../../renderSource.js';
import type { TypeMappings } from '../../typeMappings.js';

const root = resolve(import.meta.dirname, '../given/mapped_project');
const artifacts = resolve(root, 'artifacts');
const money = { package: '@acme/money' };
const mappings: TypeMappings = { 'Shared.Money': money, 'Shared.Entity': money, 'Shared.Currency': money };

describe('when mapping types to a package', () => {
    let files: ReturnType<typeof renderSource>;
    let diagnostics: string[];
    beforeEach(() => {
        diagnostics = [];
        files = renderSource(analyzeSource(resolve(root, 'tsconfig.json'), artifacts, '', true, undefined, undefined, undefined, mappings),
            { onDiagnostic: message => diagnostics.push(message) });
    });
    it('should not generate the mapped types', () => {
        [...files.keys()].filter(path => path.startsWith('Shared/')).should.deep.equal([]);
    });
    it('should still generate every other type and operation', () => {
        [...files.keys()].should.include.members(['Orders/Order.ts', 'Orders/PlaceOrder.ts', 'Orders/All.ts', 'Orders/Current.ts']);
    });
    it('should import a mapped class in a command and use it as the runtime constructor', () => {
        files.get('Orders/PlaceOrder.ts')!.should.include("import { Money } from '@acme/money';")
            .and.include('new PropertyDescriptor(\'price\', Money, false)');
    });
    it('should import a mapped class in a model', () => {
        files.get('Orders/Order.ts')!.should.include("import { Money } from '@acme/money';").and.include('@field(Money)');
    });
    it('should extend a mapped base class from its package', () => {
        files.get('Orders/Order.ts')!.should.include("import { Entity } from '@acme/money';").and.include('export class Order extends Entity');
    });
    it('should import a mapped enum and keep its primitive constructor', () => {
        files.get('Orders/Order.ts')!.should.include("import { Currency } from '@acme/money';").and.include('@field(String)');
    });
    it('should import a mapped array element in a query', () => {
        files.get('Orders/Current.ts')!.should.include("import { Money } from '@acme/money';").and.include('Money[]');
    });
    it('should keep the route', () => {
        files.get('Orders/PlaceOrder.ts')!.should.include("route: string = '/api/orders/place-order'");
    });
    it('should not report a diagnostic when every mapping matched', () => {
        diagnostics.should.deep.equal([]);
    });
});
