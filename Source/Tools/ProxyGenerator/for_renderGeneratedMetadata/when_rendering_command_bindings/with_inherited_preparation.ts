// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';
import { given } from '../../given.js';
import { a_markers_project } from '../given/a_markers_project.js';

describe('when rendering an inherited command that may reject preparation', given(a_markers_project, context => {
    let rendered: string;
    beforeEach(() => { rendered = renderGeneratedMetadata(context.project, context.artifacts, context.output); });
    it('should bind only the service after the prepared value', () => {
        rendered.should.contain("handleParameters: 1, provideParameters: 0, generatedBindings: true, injected: new Map([['handle', [_arc");
    });
    it('should include base fields and the inherited method arities in the signature', () => {
        rendered.should.contain('\\"name\\":\\"InheritedTask\\",\\"fields\\":[[\\"title\\",\\"String\\"],[\\"count\\",\\"Number\\"]],\\"handle\\":2,\\"provide\\":0');
    });
}));
