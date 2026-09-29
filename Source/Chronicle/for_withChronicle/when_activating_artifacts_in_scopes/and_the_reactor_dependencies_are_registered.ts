// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_chronicle_builder } from '../when_registering_artifact_fallbacks/given/a_chronicle_builder.js';
import { Dependency, FallbackReactor } from '../when_registering_artifact_fallbacks/given/artifacts.js';

describe('when activating artifacts in scopes and the reactor dependencies are registered', given(a_chronicle_builder, context => {
    beforeEach(async () => {
        context.start();
        context.withScopedActivation();
        context.builder.services.addScoped(Dependency);
        context.builder.add(FallbackReactor);
        await context.build();
    });
    afterEach(() => context.dispose());
    it('should build the application', () => { (context.application === undefined).should.equal(false); });
}));
