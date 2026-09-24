// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';
import { given } from '../../given.js';
import { a_markers_project } from '../given/a_markers_project.js';

describe('when rendering a command with built-in parameter markers', given(a_markers_project, context => {
    let rendered: string;
    beforeEach(() => {
        rendered = renderGeneratedMetadata(context.project, context.artifacts, context.output);
    });
    it('should bind the provided value, keyed read model, command context, and signal in declaration order', () => {
        rendered.should.contain('commandReadModel(_arc');
        rendered.should.contain('{ optional: true }');
        rendered.should.contain('commandContext(), abortSignal()');
        rendered.should.contain('handleParameters: 3');
        rendered.should.contain("['provide', [commandContext(), abortSignal()]]");
    });
}));
