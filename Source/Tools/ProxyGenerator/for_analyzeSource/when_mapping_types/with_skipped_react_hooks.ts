// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { analyzeSource } from '../../analyzeSource.js';
import { renderSource } from '../../renderSource.js';
import type { TypeMappings } from '../../typeMappings.js';

const root = resolve(import.meta.dirname, '../given/mapped_project');
const mappings: TypeMappings = { 'Shared.Money': { package: '@acme/money' } };

describe('when mapping types and skipping react hooks', () => {
    let files: ReturnType<typeof renderSource>;
    beforeEach(() => {
        files = renderSource(analyzeSource(resolve(root, 'tsconfig.json'), resolve(root, 'artifacts'), '', true, undefined, undefined, undefined, mappings),
            { skipReactHooks: true });
    });
    it('should still import the mapped type in a command', () => {
        files.get('Orders/PlaceOrder.ts')!.should.include("import { Money } from '@acme/money';");
    });
    it('should not import react hooks', () => {
        files.get('Orders/PlaceOrder.ts')!.should.not.include('@cratis/arc.react');
        files.get('Orders/Current.ts')!.should.not.include('@cratis/arc.react');
    });
});
