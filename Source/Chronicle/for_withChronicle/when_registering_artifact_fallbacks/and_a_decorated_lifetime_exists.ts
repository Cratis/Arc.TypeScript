// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '@cratis/arc.core';
import { given } from '../../given.js';
import { a_chronicle_builder } from './given/a_chronicle_builder.js';
import { DecoratedReactor } from './given/artifacts.js';

describe('when registering artifact fallbacks and a decorated lifetime exists', given(a_chronicle_builder, context => {
    beforeEach(async () => {
        context.start();
        context.builder.add(DecoratedReactor);
        context.withChronicle();
        await context.build();
    });
    afterEach(() => context.dispose());
    it('should keep a single registration', () => { context.registrationsFor(DecoratedReactor).should.have.lengthOf(1); });
    it('should keep the decorated lifetime', () => { context.registration(DecoratedReactor).lifetime.should.equal(ServiceLifetime.Singleton); });
}));
