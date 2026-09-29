// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { serviceToken } from '@cratis/arc.core';
import { given } from '../../given.js';
import { a_chronicle_builder } from './given/a_chronicle_builder.js';
import { Dependency, FallbackReactor } from './given/artifacts.js';

const holder = serviceToken<FallbackReactor>('Holder of a fallback reactor');

describe('when registering artifact fallbacks and a singleton depends on a fallback', given(a_chronicle_builder, context => {
    let failure: Error | undefined;
    beforeEach(async () => {
        context.start();
        context.withChronicle();
        context.builder.add(FallbackReactor);
        context.builder.services.addSingleton(Dependency);
        context.builder.services.addSingleton(holder, scope => scope.resolve(FallbackReactor));
        await context.build();
        try { await context.inScope(scope => scope.resolve(holder)); }
        catch (error) { failure = error as Error; }
    });
    afterEach(() => context.dispose());
    it('should reject the captive dependency', () => { failure!.message.should.contain('Captive service dependency'); });
}));
