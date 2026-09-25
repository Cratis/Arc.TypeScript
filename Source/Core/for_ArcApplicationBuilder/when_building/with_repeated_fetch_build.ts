// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_fetch_application_builder } from '../given/a_fetch_application_builder.js';
should();
describe('when building a fetch application twice', given(a_fetch_application_builder, context => {
    let synchronous: unknown;
    let rejection: unknown;
    let returnedPromise = false;
    beforeEach(async () => {
        const application = await context.builder.build();
        await application.dispose();
        try {
            const result = context.builder.build();
            returnedPromise = result instanceof Promise;
            await result.catch(error => { rejection = error; });
        } catch (error) { synchronous = error; }
    });
    it('should return a rejected promise instead of throwing synchronously', () => {
        (synchronous === undefined).should.equal(true);
        returnedPromise.should.equal(true);
        (rejection as Error).message.should.contain('only once');
    });
}));
