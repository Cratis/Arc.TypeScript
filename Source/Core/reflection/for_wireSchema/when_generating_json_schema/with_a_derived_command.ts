// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcApplication } from '../../../ArcApplication.js';
import { EchoNotice } from '../../../../../ContractTests/Http/modelBound/polymorphic/EchoNotice.js';
should();

describe('when generating JSON Schema with a derived command field', () => {
    let schema: Record<string, unknown>;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(EchoNotice);
        const app = await builder.build();
        try {
            const document = app.server.openApi();
            const paths = document.paths as Record<string, { post: { requestBody: { content: { 'application/json': { schema: Record<string, unknown> } } } } }>;
            schema = paths['/api/fixtures/echo-notice']!.post.requestBody.content['application/json'].schema;
        } finally { await app.dispose(); }
    });
    it('should describe the concrete type with oneOf on the nested field', () => {
        const properties = schema.properties as Record<string, { oneOf: unknown[] }>;
        properties.notice!.oneOf.should.have.lengthOf(1);
    });
});
