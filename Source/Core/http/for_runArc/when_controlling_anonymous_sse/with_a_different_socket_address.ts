// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { given } from '../../../given.js';
import { an_anonymous_sse_host } from '../given/an_anonymous_sse_host.js';

should();

describe('when controlling anonymous SSE with a different socket address', given(an_anonymous_sse_host, context => {
    let status: number;

    beforeEach(async () => {
        await context.start();
        const opened = await context.open('127.0.0.1');
        const control = await context.send('::1', '/.cratis/queries/sse/unsubscribe', 'POST',
            JSON.stringify({ connectionId: opened.id, queryId: 'Public' }));
        status = control.statusCode!;
        control.resume();
    });

    afterEach(async () => { await context.dispose(); });

    it('should hide the connection from a different socket peer', () => { status.should.equal(404); });
}));
