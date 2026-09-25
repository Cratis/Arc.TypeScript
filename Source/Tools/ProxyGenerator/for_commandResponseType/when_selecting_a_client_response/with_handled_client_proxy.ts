// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { analyzeSource } from '../../analyzeSource.js';
import { renderSource } from '../../renderSource.js';

const root = resolve(import.meta.dirname, '../given');

describe('when selecting a command client response with a handled client proxy', () => {
    let proxy: string;
    beforeEach(() => {
        proxy = renderSource(analyzeSource(resolve(root, 'tsconfig.json'), resolve(root, 'Features'))).get('JustEvent.ts')!;
    });
    it('should use a void command response without a client event model', () => {
        proxy.should.contain('extends Command<IJustEvent>');
        proxy.should.contain('super(Object, false)');
    });
});
