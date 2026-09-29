// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_chronicle_builder } from './given/a_chronicle_builder.js';
import { UnbindableReactor } from './given/artifacts.js';

describe('when registering artifact fallbacks and a reactor constructor cannot be bound', given(a_chronicle_builder, context => {
    let failure: Error | undefined;
    beforeEach(async () => {
        context.start();
        context.withChronicle();
        context.builder.add(UnbindableReactor);
        await context.build();
        try { await context.inScope(scope => scope.resolve(UnbindableReactor)); }
        catch (error) { failure = error as Error; }
    });
    afterEach(() => context.dispose());
    it('should still build the application', () => { (context.application === undefined).should.equal(false); });
    it('should report the binding failure on resolution', () => { failure!.message.should.contain('UnbindableReactor'); });
}));
