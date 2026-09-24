// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';

describe('when serving openapi with generated result', () => {
    let operation: Record<string, unknown>;
    beforeEach(async () => {
        const server = new ArcServer({ openApiVersion: '2.1.0', commands: [{ name: 'Write', schema: z.object({ value: z.string() }),
            generatedReturn: { cardinality: 'one', nullable: false, element: String }, handle: input => (input as { value: string }).value }] });
        const response = await server.handle(new Request('http://localhost/openapi.json'));
        const document = await response!.json() as { info: { version: string }; paths: Record<string, { post: Record<string, unknown> }> };
        document.info.version.should.equal('2.1.0');
        operation = document.paths['/api/write']!.post;
    });
    it('should publish a typed response on the registered route', () => {
        const responses = operation.responses as Record<string, { content: { 'application/json': { schema: { properties: { response: { type: string } } } } } }>;
        responses['200']!.content['application/json'].schema.properties.response.type.should.equal('string');
    });
});
