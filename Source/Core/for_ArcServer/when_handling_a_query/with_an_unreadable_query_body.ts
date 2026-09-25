// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import sinon from 'sinon';
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';

should();

describe('when handling a query with an unreadable QUERY body', () => {
    const perform = sinon.spy(() => [{ name: 'Ada' }]);
    const server = new ArcServer({ queries: [defineQuery({ name: 'Items', schema: z.object({}), perform })] });
    let response: Response;
    let result: { isValid: boolean; hasExceptions: boolean; exceptionMessages: string[];
        exceptionStackTrace: string; validationResults: unknown[] };
    beforeEach(async () => {
        response = (await server.handle(new Request('http://localhost/api/items', {
            method: 'QUERY', headers: { 'content-type': 'application/json' }, body: '{'
        })))!;
        result = await response.json();
    });
    afterAll(() => server.dispose());
    it('should reject the request', () => response.status.should.equal(400));
    it('should disable caching', () => response.headers.get('cache-control')!.should.equal('no-store'));
    it('should remain valid', () => result.isValid.should.equal(true));
    it('should report an exception', () => result.hasExceptions.should.equal(true));
    it('should redact the exception', () => result.exceptionMessages.should.deep.equal(['An unexpected error occurred']));
    it('should omit the stack trace', () => result.exceptionStackTrace.should.equal(''));
    it('should not report validation results', () => result.validationResults.should.deep.equal([]));
    it('should not execute the handler', () => perform.called.should.be.false);
});
