// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
should();

describe('when handling a query with a custom correlation header', () => {
    let response: Response;
    beforeEach(async () => {
        const server = new ArcServer({ correlationId: { httpHeader: 'X-Request-Correlation' }, queries: [defineQuery({
            name: 'Items', schema: z.object({}), perform: () => []
        })] });
        try {
            response = (await server.handle(new Request('http://localhost/api/items', {
                headers: { 'X-Request-Correlation': '11111111-1111-4111-8111-111111111111' }
            })))!;
        } finally { await server.dispose(); }
    });
    it('should return the same ID in the selected header and result', async () => {
        response.headers.get('X-Request-Correlation')!.should.equal('11111111-1111-4111-8111-111111111111');
        (await response.json()).correlationId.should.equal('11111111-1111-4111-8111-111111111111');
    });
    it('should not emit the default header', () => { response.headers.has('X-Correlation-ID').should.equal(false); });
});
