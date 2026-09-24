// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';
import { given } from '../../given.js';
import { an_invalid_project } from '../given/an_invalid_project.js';

describe('when analyzing a command with an interface parameter', given(an_invalid_project, context => {
    let error: unknown;
    beforeEach(() => {
        try { renderGeneratedMetadata(context.project, context.artifacts, context.output); }
        catch (failure) { error = failure; }
    });
    it('should require an explicit class token and identify the source location', () => {
        (error as Error).message.should.match(/WriteReport\.ts:\d+: Cannot inject ReportSink: only concrete class tokens/);
    });
}));
