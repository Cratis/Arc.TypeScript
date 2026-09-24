// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';
import { given } from '../../given.js';
import { a_union_project } from '../given/a_union_project.js';

describe('when analyzing a union of concrete service classes', given(a_union_project, context => {
    let error: unknown;
    beforeEach(() => {
        try { renderGeneratedMetadata(context.project, context.artifacts, context.output); }
        catch (failure) { error = failure; }
    });
    it('should reject the ambiguous binding at its source line', () => {
        (error as Error).message.should.match(/MixedServices\.ts:8: Cannot infer service: union of multiple classes/);
    });
}));
