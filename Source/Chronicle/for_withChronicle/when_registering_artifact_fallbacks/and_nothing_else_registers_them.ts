// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '@cratis/arc.core';
import { given } from '../../given.js';
import { a_chronicle_builder } from './given/a_chronicle_builder.js';
import { Dependency, FallbackReactor, FallbackReducer } from './given/artifacts.js';

describe('when registering artifact fallbacks and nothing else registers them', given(a_chronicle_builder, context => {
    let resolved: FallbackReactor;
    beforeEach(async () => {
        context.start();
        FallbackReactor.constructed = 0;
        FallbackReducer.constructed = 0;
        context.withChronicle();
        context.builder.add(FallbackReactor, FallbackReducer);
        context.builder.services.addSingleton(Dependency);
        await context.build();
    });
    afterEach(() => context.dispose());
    it('should register the reactor as scoped', () => { context.registration(FallbackReactor).lifetime.should.equal(ServiceLifetime.Scoped); });
    it('should register the reducer as scoped', () => { context.registration(FallbackReducer).lifetime.should.equal(ServiceLifetime.Scoped); });
    it('should not construct the reactor while building', () => { FallbackReactor.constructed.should.equal(0); });
    it('should not construct the reducer while building', () => { FallbackReducer.constructed.should.equal(0); });
    it('should resolve the reactor with its constructor dependencies', async () => {
        resolved = await context.inScope(scope => scope.resolve(FallbackReactor));
        resolved.dependency.should.be.instanceOf(Dependency);
    });
}));
