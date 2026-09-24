// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { given } from '../../../given.js';
import { a_rendering_server } from '../given/a_rendering_server.js';
should();

describe('when rendering a snapshot with a provider result', given(a_rendering_server, context => {
    let response: Response;
    beforeEach(async () => {
        response = (await context.server.handle(new Request('http://localhost/api/tasks?page=0&pageSize=1')))!;
    });
    afterAll(() => context.server.dispose());
    it('should apply the renderer then intercept the model before sending it', async () => {
        (await response.json()).data.should.deep.equal([{ name: 'public-provider' }]);
    });
    it('should preserve the provider total', async () => {
        (await response.json()).paging.totalItems.should.equal(3);
    });
    it('should render before intercepting', () => {
        context.seen.slice(-2).should.deep.equal(['render', 'provider']);
    });
}));
