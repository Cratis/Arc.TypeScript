// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderSource } from '../../renderSource.js';
import type { SourceAnalysis } from '../../SourceAnalysis.js';

const type = (key: string) => ({ text: 'Item', constructor: 'Item', model: 'Item', modelKey: key,
    enumerable: false, nullable: false, void: false });

describe('when rendering models with equal names in different namespaces', () => {
    let files: ReadonlyMap<string, string>;
    beforeEach(() => {
        const analysis: SourceAnalysis = { models: [
            { kind: 'model', name: 'Item', namespace: 'Orders', fields: [] },
            { kind: 'model', name: 'Item', namespace: 'Invoices', fields: [] }
        ], operations: [
            { kind: 'query', namespace: 'Orders', owner: 'Item', name: 'find', fields: [], roles: [], result: type('Orders.Item') },
            { kind: 'query', namespace: 'Invoices', owner: 'Item', name: 'find', fields: [], roles: [], result: type('Invoices.Item') }
        ] };
        files = renderSource(analysis);
    });
    it('should emit each model in its namespace folder', () => {
        [...files.keys()].should.include.members(['Orders/Item.ts', 'Invoices/Item.ts']);
    });
    it('should import the matching model for each query', () => {
        files.get('Orders/Find.ts')!.should.include("from './Item'");
        files.get('Invoices/Find.ts')!.should.include("from './Item'");
    });
});
