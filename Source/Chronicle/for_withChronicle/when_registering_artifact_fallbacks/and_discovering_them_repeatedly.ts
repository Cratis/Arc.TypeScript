// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_chronicle_builder } from './given/a_chronicle_builder.js';
import { FallbackReactor, FallbackReducer } from './given/artifacts.js';

describe('when registering artifact fallbacks and discovering them repeatedly', given(a_chronicle_builder, context => {
    beforeEach(async () => {
        context.start();
        context.withChronicle();
        context.builder.add(FallbackReactor, FallbackReducer);
        context.builder.add(FallbackReactor, FallbackReducer);
        await context.build();
    });
    afterEach(() => context.dispose());
    it('should register the reactor once', () => { context.registrationsFor(FallbackReactor).should.have.lengthOf(1); });
    it('should register the reducer once', () => { context.registrationsFor(FallbackReducer).should.have.lengthOf(1); });
}));
