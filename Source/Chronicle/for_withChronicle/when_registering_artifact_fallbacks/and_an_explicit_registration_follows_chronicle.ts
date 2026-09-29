// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '@cratis/arc.core';
import { given } from '../../given.js';
import { a_chronicle_builder } from './given/a_chronicle_builder.js';
import { Dependency, FallbackReactor } from './given/artifacts.js';

describe('when registering artifact fallbacks and an explicit registration follows Chronicle', given(a_chronicle_builder, context => {
    beforeEach(async () => {
        context.start();
        context.withChronicle();
        context.builder.add(FallbackReactor);
        context.builder.services.addTransient(FallbackReactor, () => new FallbackReactor(new Dependency()));
        await context.build();
    });
    afterEach(() => context.dispose());
    it('should keep a single registration', () => { context.registrationsFor(FallbackReactor).should.have.lengthOf(1); });
    it('should keep the explicit lifetime', () => { context.registration(FallbackReactor).lifetime.should.equal(ServiceLifetime.Transient); });
}));
