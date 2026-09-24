// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { randomUUID } from 'node:crypto';
import { ArcApplication, canonicalMetadataSignature, command, optionalService, Severity } from '../../index.js';
import type { CommandResult } from '../../commands/CommandResult.js';

class Service { readonly name = 'registered'; }
@command()
class OptionalTask {
    handle(service: Service | null): string { return service?.name ?? 'missing'; }
}

describe('when executing a generated command with an unregistered nullable service', () => {
    let result: CommandResult;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.useGeneratedMetadata({ version: 1, artifacts: [{ type: OptionalTask,
            signature: canonicalMetadataSignature('OptionalTask', [], 1, null, []),
            metadata: { command: true, handleParameters: 1, injected: new Map([['handle', [optionalService(Service)]]]),
                handleResult: { cardinality: 'one', nullable: false, element: String } } }] });
        builder.add(OptionalTask);
        const app = await builder.build();
        try {
            result = await app.server.execute(new OptionalTask(), { correlationId: randomUUID(), signal: new AbortController().signal,
                allowedSeverity: Severity.Warning, principal: undefined, tenantId: undefined });
        } finally { await app.dispose(); }
    });
    it('should pass null rather than fail preflight', () => {
        (result.response as string).should.equal('missing');
    });
});
