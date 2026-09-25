// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { given } from '../../../given.js';
import { an_anonymous_sse_host } from '../given/an_anonymous_sse_host.js';

should();

describe('when opening anonymous SSE with different socket addresses', given(an_anonymous_sse_host, context => {
    let firstStatus: number;
    let secondStatus: number;

    beforeEach(async () => {
        await context.start();
        const first = await context.open('127.0.0.1');
        firstStatus = first.response.statusCode!;
        const second = await context.open('::1');
        secondStatus = second.response.statusCode!;
    });

    afterEach(async () => { await context.dispose(); });

    it('should give each socket peer its own connection budget', () => {
        firstStatus.should.equal(200);
        secondStatus.should.equal(200);
    });
}));
