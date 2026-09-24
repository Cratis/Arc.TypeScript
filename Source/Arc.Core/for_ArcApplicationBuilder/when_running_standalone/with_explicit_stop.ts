// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

describe('when stopping a running standalone application', given(an_application_builder, context => {
    let settledBeforeStop: boolean;
    let settledAfterStop: boolean;
    beforeEach(async () => {
        const application = await context.create().build();
        let settled = false;
        const running = application.run({ port: 0 }).then(() => { settled = true; });
        await new Promise(resolve => setTimeout(resolve, 100));
        settledBeforeStop = settled;
        await application.stop();
        await running;
        settledAfterStop = settled;
    });
    it('should remain pending while listening', () => { settledBeforeStop.should.equal(false); });
    it('should resolve after the listener stops', () => { settledAfterStop.should.equal(true); });
}));
