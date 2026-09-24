// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { renderOpenApi } from '../../renderOpenApi.js';
import { an_operation_set } from '../given/an_operation_set.js';

describe('when documenting generated results with command and query', given(an_operation_set, context => {
    let paths: Record<string, Record<string, { responses: Record<string, { content: Record<string, { schema: Record<string, unknown> }> }>; parameters?: { name: string }[] }>>;
    let version: string;
    beforeEach(() => {
        const document = renderOpenApi([context.command], [context.query], { openApiVersion: '2.0.0' });
        version = (document.info as { version: string }).version;
        paths = document.paths as typeof paths;
    });
    it('should publish the configured version', () => {
        version.should.equal('2.0.0');
    });
    it('should describe the typed command response', () => {
        const schema = paths['/api/save']!.post!.responses['200']!.content['application/json']!.schema;
        ((schema.properties as Record<string, Record<string, unknown>>).response!.type as string).should.equal('string');
    });
    it('should omit typed data from failed result envelopes', () => {
        for (const code of ['400', '403', '500']) {
            const command = paths['/api/save']!.post!.responses[code]!.content['application/json']!.schema;
            const query = paths['/api/all']!.get!.responses[code]!.content['application/json']!.schema;
            (Object.hasOwn(command.properties as object, 'response')).should.equal(false);
            (Object.hasOwn(query.properties as object, 'data')).should.equal(false);
            const validation = (query.properties as Record<string, { items?: { properties: Record<string, unknown> } }>).validationResults!;
            Object.keys(validation.items!.properties).should.include.members(['reasonDetail', 'state']);
        }
    });
    it('should describe the paged query data and GET options', () => {
        const operation = paths['/api/all']!.get!;
        const schema = operation.responses['200']!.content['application/json']!.schema;
        ((schema.properties as Record<string, Record<string, unknown>>).data!.type as string).should.equal('array');
        operation.parameters!.map(parameter => parameter.name).should.include.members(['filter', 'page', 'pageSize', 'sortBy', 'sortDirection']);
    });
}));
