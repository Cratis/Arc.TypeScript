// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_showcase_catalog } from '../given/a_showcase_catalog.js';

describe('when asking for the latest catalog rows', given(a_showcase_catalog, context => {
    let result: Awaited<ReturnType<typeof context.latest.perform>>;
    beforeEach(async () => { result = await context.latest.perform({}); });
    afterAll(async () => { await context.all.dispose(); await context.latest.dispose(); });
    it('should return the five newest rows, newest first', () => {
        result.data?.map(item => item.id).should.deep.equal([12, 11, 10, 9, 8]);
    });
}));
