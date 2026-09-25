// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_server_exposing_query_reader_errors } from '../given/a_server_exposing_query_reader_errors.js';

should();
describe('when handling a QUERY reader failure with exception exposure enabled', given(a_server_exposing_query_reader_errors, context => {
    let result: { exceptionMessages: string[]; exceptionStackTrace: string; hasExceptions: boolean };
    beforeEach(async () => {
        const response = await context.server.handle(new Request('http://localhost/api/items', { method: 'QUERY', body: '{' }));
        result = await response!.json();
    });
    afterAll(() => context.server.dispose());
    it('should expose the reader error', () => result.exceptionMessages[0]!.should.contain('UnreadableQueryBody'));
    it('should include a stack trace', () => result.exceptionStackTrace.should.not.be.empty);
    it('should report the exception', () => result.hasExceptions.should.be.true);
}));
