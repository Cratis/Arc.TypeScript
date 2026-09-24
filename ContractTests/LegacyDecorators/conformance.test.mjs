// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it } from 'node:test';
import { should } from 'chai';
import { application, consumerValue } from './dist/fixture.js';
should();

describe('when compiling legacy decorators with emitted metadata', () => {
    it('should infer method services for commands', async () => {
        const result = await application.server.handle(new Request('http://localhost/api/check-command', {
            method: 'POST', body: '{}', headers: { 'content-type': 'application/json' }
        }));
        (await result.json()).response.should.equal('inferred');
    });
    it('should infer method services for queries', async () => {
        const result = await application.server.handle(new Request('http://localhost/api/check'));
        (await result.json()).data.should.equal('inferred');
    });
    it('should infer constructor services', async () => {
        (await consumerValue()).should.equal('inferred');
    });
});
