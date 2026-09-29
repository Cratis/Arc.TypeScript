// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '@cratis/arc.core';
import { given } from '../../given.js';
import { a_chronicle_builder } from './given/a_chronicle_builder.js';
import { Dependency, FallbackReactor } from './given/artifacts.js';

describe('when registering artifact fallbacks and options services register them', given(a_chronicle_builder, context => {
    beforeEach(async () => {
        context.start({ services: [{ token: FallbackReactor, lifetime: ServiceLifetime.Singleton,
            instance: new FallbackReactor(new Dependency()) }] });
        context.withChronicle();
        context.builder.add(FallbackReactor);
        await context.build();
    });
    afterEach(() => context.dispose());
    it('should not add a builder registration', () => { context.registrationsFor(FallbackReactor).should.have.lengthOf(0); });
    it('should keep the options lifetime', () => { context.registration(FallbackReactor).lifetime.should.equal(ServiceLifetime.Singleton); });
}));
