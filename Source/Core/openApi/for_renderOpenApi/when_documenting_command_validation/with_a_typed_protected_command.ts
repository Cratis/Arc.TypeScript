// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { renderOpenApi } from '../../renderOpenApi.js';
import { jwtBearer } from '../../../authentication/jwtBearer.js';
import { an_operation_set } from '../given/an_operation_set.js';
import type { Operation } from '../../../http/Operation.js';

const handler = jwtBearer({ jwksUrl: new URL('https://example.invalid/keys'), issuer: 'issuer', audience: 'audience', algorithms: ['RS256'] });

describe('when documenting command validation with a typed protected command', given(an_operation_set, context => {
    let execute: Record<string, unknown>;
    let validate: Record<string, unknown>;
    beforeEach(() => {
        const command = { ...context.command, authorization: { authenticated: true } } as Operation;
        const document = renderOpenApi([command], [], { authentication: [handler] });
        const paths = document.paths as Record<string, { post: Record<string, unknown> }>;
        execute = paths['/api/save']!.post;
        validate = paths['/api/save/validate']!.post;
    });
    it('should use a distinct stable operation id', () => {
        (validate.operationId as string).should.equal('Tasks.Save:validate');
    });
    it('should share the required body, security and tag with execution', () => {
        (validate.requestBody as object).should.deep.equal(execute.requestBody);
        (validate.security as object).should.deep.equal(execute.security);
        (validate.tags as string[]).should.deep.equal(execute.tags);
    });
    it('should document 401 on both execution and validation', () => {
        const executionResponses = execute.responses as Record<string, unknown>;
        const validationResponses = validate.responses as Record<string, unknown>;
        Object.keys(executionResponses).should.deep.equal(['200', '400', '401', '403', '500']);
        Object.keys(validationResponses).should.deep.equal(Object.keys(executionResponses));
    });
    it('should describe the untyped validation result for every status', () => {
        const responses = validate.responses as Record<string, { content: { 'application/json': { schema: { properties: object } } } }>;
        for (const response of Object.values(responses)) {
            Object.hasOwn(response.content['application/json'].schema.properties, 'response').should.equal(false);
        }
    });
}));
