// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_chronicle_builder } from '../when_registering_artifact_fallbacks/given/a_chronicle_builder.js';
import { UnbindableReactor } from '../when_registering_artifact_fallbacks/given/artifacts.js';

describe('when activating artifacts in scopes and a reactor constructor cannot be bound', given(a_chronicle_builder, context => {
    let failure: Error | undefined;
    beforeEach(async () => {
        failure = undefined;
        context.start();
        context.withScopedActivation();
        context.builder.add(UnbindableReactor);
        try { await context.build(); }
        catch (error) { failure = error as Error; }
    });
    afterEach(() => context.dispose());
    it('should fail the build naming the artifact', () => {
        failure!.message.should.contain('Chronicle artifact UnbindableReactor cannot be activated in a scope');
    });
    it('should report the binding failure', () => { failure!.message.should.contain('use explicit tokens'); });
}));
