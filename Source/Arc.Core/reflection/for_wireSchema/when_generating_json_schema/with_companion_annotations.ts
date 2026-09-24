// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../../index.js';
import { SaveMessages } from '../given/SaveMessages.js';

describe('when generating a wire schema with companion field annotations', () => {
    let payload: Record<string, unknown>;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(SaveMessages);
        const application = await builder.build();
        try {
            const response = (await application.server.handle(new Request('http://localhost/.cratis/commands')))!;
            const commands = await response.json() as { payloadSchema: Record<string, unknown> }[];
            payload = commands[0]!.payloadSchema;
        } finally { await application.dispose(); }
    });
    it('should omit optional and defaulted fields from the required set', () => {
        (payload.required as string[]).should.deep.equal(['messages', 'alternative']);
    });
    it('should describe numeric enumeration members', () => {
        const properties = payload.properties as Record<string, { anyOf?: { const: number }[]; enum?: number[] }>;
        const values = properties.priority!.anyOf?.map(item => item.const) ?? properties.priority!.enum;
        values!.should.deep.equal([1, 2]);
    });
});
