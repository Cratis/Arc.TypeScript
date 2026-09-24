// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, canonicalMetadataSignature, command } from '../../index.js';

class Service {}
@command()
class OverboundTask {
    provide(): Service { return new Service(); }
    handle(prepared: Service, service: Service): void { void prepared; void service; }
}

describe('when loading more handle bindings than parameters', () => {
    let error: unknown;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.useGeneratedMetadata({ version: 1, artifacts: [{ type: OverboundTask,
            signature: canonicalMetadataSignature('OverboundTask', [], 2, 0, []),
            metadata: { command: true, handleParameters: 1, provideParameters: 0,
                injected: new Map([['handle', [Service, Service]], ['provide', []]]) } }] });
        builder.services.addSingleton(Service);
        builder.add(OverboundTask);
        try { await builder.build(); }
        catch (failure) { error = failure; }
    });
    it('should reject excess tokens despite the generated binding marker', () => {
        (error as Error).message.should.contain('Unbound handle parameters on OverboundTask.handle');
    });
});
