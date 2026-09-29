// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '@cratis/arc.core';
import type { ChronicleOptions, IChronicleClient } from '@cratis/chronicle';
import { ArcApplicationBuilder, Severity } from '@cratis/arc.core';
import sinon from 'sinon';
import { chronicleArtifactActivator } from '../../../chronicleArtifactActivator.js';
import { ChronicleRuntime } from '../../../ChronicleRuntime.js';
import { withChronicle } from '../../../withChronicle.js';
import { Dependency, FallbackReactor } from '../../when_registering_artifact_fallbacks/given/artifacts.js';

describe('when activating artifacts in scopes with a caller-owned client created with its activator', () => {
    let options: ChronicleOptions;
    let dispose: sinon.SinonSpy;
    let resolvedReactor: unknown;
    beforeEach(async () => {
        const built: { server?: ArcServer } = {};
        const artifactActivator = chronicleArtifactActivator(() => built.server!, 'Orders');
        options = Object.freeze({ artifactActivator }) as unknown as ChronicleOptions;
        dispose = sinon.spy();
        const client = { options, dispose, getEventStore: async () => ({}) } as unknown as IChronicleClient;
        const builder = new ArcApplicationBuilder();
        withChronicle(builder, { client, eventStore: 'Orders', activateArtifactsInScopes: true });
        builder.services.addScoped(Dependency);
        builder.add(FallbackReactor);
        const application = await builder.build();
        built.server = application.server;
        const scope = application.server.services.createScope({ tenantId: 'tenant', correlationId: crypto.randomUUID(), principal: undefined,
            signal: new AbortController().signal, allowedSeverity: Severity.Error });
        await scope.resolve(ChronicleRuntime);
        resolvedReactor = await scope.resolve(FallbackReactor);
        await scope.dispose();
        await application.dispose();
    });
    it('should resolve the reactor with its dependencies', () => { resolvedReactor!.should.be.instanceOf(FallbackReactor); });
    it('should leave the client options unchanged', () => { Object.keys(options).should.deep.equal(['artifactActivator']); });
    it('should not dispose the client', () => { dispose.called.should.equal(false); });
});
