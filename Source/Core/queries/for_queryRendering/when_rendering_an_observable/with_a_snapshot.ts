// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { given } from '../../../given.js';
import { a_rendering_server } from '../given/a_rendering_server.js';
should();

describe('when rendering an observable with a snapshot', given(a_rendering_server, context => {
    let data: unknown;
    beforeEach(async () => {
        const response = await context.server.handle(new Request('http://localhost/api/watch'));
        data = (await response!.json()).data;
    });
    afterAll(() => context.server.dispose());
    it('should intercept the current value', () => {
        (data as object[]).should.deep.equal([{ name: 'public-initial' }]);
    });
}));
