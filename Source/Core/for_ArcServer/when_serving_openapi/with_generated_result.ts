// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';

describe('when serving openapi with generated result', () => {
    let operation: Record<string, unknown>;
    let validation: Record<string, unknown>;
    let version: string;
    beforeEach(async () => {
        const server = new ArcServer({ generatedApis: { openApiVersion: '2.1.0' }, commands: [{ name: 'Write', schema: z.object({ value: z.string() }),
            generatedReturn: { cardinality: 'one', nullable: false, element: String }, summary: 'Write a value.', handle: input => (input as { value: string }).value }] });
        const response = await server.handle(new Request('http://localhost/openapi.json'));
        const document = await response!.json() as { info: { version: string }; paths: Record<string, { post: Record<string, unknown> }> };
        version = document.info.version;
        operation = document.paths['/api/write']!.post;
        validation = document.paths['/api/write/validate']!.post;
    });
    it('should publish the configured document version', () => {
        version.should.equal('2.1.0');
    });
    it('should publish the operation summary over HTTP', () => {
        (operation.summary as string).should.equal('Write a value.');
    });
    it('should publish the validation-only route over HTTP', () => {
        (validation.operationId as string).should.equal('Write:validate');
        (validation.requestBody as object).should.deep.equal(operation.requestBody);
    });
    it('should publish a typed response on the registered route', () => {
        const responses = operation.responses as Record<string, { content: { 'application/json': { schema: { properties: { response: { type: string } } } } } }>;
        responses['200']!.content['application/json'].schema.properties.response.type.should.equal('string');
    });
});
