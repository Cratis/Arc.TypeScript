// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';

const directory = resolve(import.meta.dirname, '../../for_renderSource/given/preferences_project');

describe('when discovering preferences with JSDoc summaries', () => {
    let rendered: string;
    beforeEach(() => {
        rendered = renderGeneratedMetadata(resolve(directory, 'tsconfig.json'), resolve(directory, 'artifacts'),
            resolve(directory, 'metadata.ts'));
    });
    it('should carry JSDoc summaries in generated server metadata', () => {
        rendered.should.include('summary: "Save an item."');
        rendered.should.include('methodSummaries: new Map([["find", "Find an {@link Item}."]])');
    });
});
