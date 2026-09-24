// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { QueryHttpMethod } from '@cratis/arc.core';
import { analyzeSource } from '../../analyzeSource.js';
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';

const directory = resolve(import.meta.dirname, '../../for_renderSource/given/preferences_project');

describe('when discovering preferences with identity details', () => {
    let analysis: ReturnType<typeof analyzeSource>;
    beforeEach(() => { analysis = analyzeSource(resolve(directory, 'tsconfig.json'), resolve(directory, 'artifacts'), '', true); });
    it('should discover a model reachable only from the identity provider', () => {
        analysis.models.map(model => model.name).should.contain('Details');
    });
    it('should carry the command warning preference', () => {
        (analysis.operations.find(operation => operation.name === 'Save')!.treatWarningsAsErrors as boolean).should.equal(true);
    });
    it('should carry the query HTTP method preference', () => {
        (analysis.operations.find(operation => operation.name === 'find')!.httpMethod as QueryHttpMethod).should.equal(QueryHttpMethod.Query);
    });
    it('should carry JSDoc summaries in generated server metadata', () => {
        const rendered = renderGeneratedMetadata(resolve(directory, 'tsconfig.json'), resolve(directory, 'artifacts'),
            resolve(directory, 'metadata.ts'));
        rendered.should.include('summary: "Save an item."');
        rendered.should.include('methodSummaries: new Map([["find", "Find an item."]])');
    });
});
