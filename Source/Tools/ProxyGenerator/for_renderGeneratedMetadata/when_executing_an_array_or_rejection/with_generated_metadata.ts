// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { ArcApplication, canonicalMetadataSignature, Severity, type CommandResult } from '@cratis/arc.core';
import { Plain, PlainArrayOrRejection } from '../../for_commandResponseType/given/Features/Responses.js';
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';

const root = resolve(import.meta.dirname, '../../for_commandResponseType/given');

describe('when executing an array or rejection with generated metadata', () => {
    let success: CommandResult;
    let rejection: CommandResult;
    beforeEach(async () => {
        const generated = renderGeneratedMetadata(resolve(root, 'tsconfig.json'), resolve(root, 'Features'),
            resolve(root, 'generatedMetadata.ts'));
        const entry = generated.split('\n').find(line => line.includes('\\"name\\":\\"PlainArrayOrRejection\\"'))!;
        const shapes = /handleResult: \{ cardinality: '(\w+)', nullable: (true|false), element: \w+ \},/.exec(entry);
        const valueShape = /handleValueResult: \{ cardinality: '(\w+)', nullable: (true|false) \}/.exec(entry);
        if (!shapes || !valueShape) throw new Error(entry);
        const builder = ArcApplication.createBuilder();
        builder.useGeneratedMetadata({ version: 1, artifacts: [{ type: PlainArrayOrRejection,
            signature: canonicalMetadataSignature('PlainArrayOrRejection', [['reject', 'Boolean']], 0, null, []),
            metadata: { command: true,
                handleResult: { cardinality: shapes[1] as 'many' | 'one' | 'void' | 'paged',
                    nullable: shapes[2] === 'true', element: Plain },
                handleValueResult: { cardinality: valueShape[1] as 'many' | 'one' | 'void' | 'paged',
                    nullable: valueShape[2] === 'true' } } }] });
        builder.add(PlainArrayOrRejection);
        const app = await builder.build();
        const context = () => ({ correlationId: randomUUID(), signal: new AbortController().signal,
            allowedSeverity: Severity.Warning, principal: undefined, tenantId: undefined });
        try {
            success = await app.server.execute(Object.assign(new PlainArrayOrRejection(), { reject: false }), context());
            rejection = await app.server.execute(Object.assign(new PlainArrayOrRejection(), { reject: true }), context());
        } finally { await app.dispose(); }
    });
    it('should accept the array returned on success', () => {
        success.isSuccess.should.equal(true);
    });
    it('should report the rejection as a validation failure', () => {
        rejection.validationResults.map(result => result.message).should.include('Invalid');
    });
});
