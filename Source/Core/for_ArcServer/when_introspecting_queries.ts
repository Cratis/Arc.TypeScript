// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import { given } from '../given.js';
import { a_server_with_a_list_query } from './given/a_server_with_a_list_query.js';

should();

describe('when introspecting queries', given(a_server_with_a_list_query, context => {
    let metadata: { argumentsSchema: { required: string[] } }[];

    beforeEach(async () => {
        const response = await context.server.handle(new Request('http://localhost/.cratis/queries'));
        metadata = await response!.json();
    });
    afterAll(async () => context.server.dispose());

    it('should list required schema properties', () => metadata[0]!.argumentsSchema.required.should.deep.equal(['limit']));
}));
