// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { generatedMetadataFor } from '../../reflection/registerGeneratedMetadata.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

class Artifact {}

should();
describe('when borrowing scopes from servers with distinct generated metadata', () => {
    let observed: (string | undefined)[];
    beforeEach(async () => {
        const first = new ArcServer({}, new Map([[Artifact, { namespace: 'first' }]]));
        const second = new ArcServer({}, new Map([[Artifact, { namespace: 'second' }]]));
        const firstScope = first.services.createScope(serviceContext('first'));
        const secondScope = second.services.createScope(serviceContext('second'));
        try {
            observed = [];
            await first.runInScope(firstScope, async () => {
                observed.push(generatedMetadataFor(Artifact)?.namespace);
                await second.runInScope(secondScope, async () => {
                    await Promise.resolve();
                    observed.push(generatedMetadataFor(Artifact)?.namespace);
                });
                observed.push(generatedMetadataFor(Artifact)?.namespace);
            });
            observed.push(generatedMetadataFor(Artifact)?.namespace);
        } finally { await firstScope.dispose(); await secondScope.dispose(); await first.dispose(); await second.dispose(); }
    });
    it('should restore the correct server metadata for each boundary', () => {
        observed.should.deep.equal(['first', 'second', 'first', undefined]);
    });
});
