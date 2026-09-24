// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';
import { given } from '../../given.js';
import { a_markers_project } from '../given/a_markers_project.js';

describe('when rendering case-differing queries with Fundamentals arguments', given(a_markers_project, context => {
    let rendered: string;
    beforeEach(() => { rendered = renderGeneratedMetadata(context.project, context.artifacts, context.output); });
    it('should order names by code unit in the canonical signature', () => {
        rendered.should.contain('\\"queries\\":[[\\"byIdA\\",0],[\\"by_id\\",3]]');
    });
    it('should import named Fundamentals runtime tokens', () => {
        rendered.should.contain('Guid as _arc');
        rendered.should.contain('DateOnly as _arc');
        rendered.should.contain('from "@cratis/fundamentals"');
    });
    it('should bind nullable services optionally', () => {
        rendered.should.contain("kind: 'service', token: _arc");
        rendered.should.contain('optional: true');
    });
}));
