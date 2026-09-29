// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_chronicle_builder } from '../when_registering_artifact_fallbacks/given/a_chronicle_builder.js';
import { FallbackReactor } from '../when_registering_artifact_fallbacks/given/artifacts.js';

describe('when activating artifacts in scopes and a reactor dependency is missing', given(a_chronicle_builder, context => {
    let failure: Error | undefined;
    beforeEach(async () => {
        context.start();
        context.withScopedActivation();
        context.builder.add(FallbackReactor);
        try { await context.build(); }
        catch (error) { failure = error as Error; }
    });
    afterEach(() => context.dispose());
    it('should fail the build', () => { failure!.message.should.contain('Missing service: Dependency'); });
}));
