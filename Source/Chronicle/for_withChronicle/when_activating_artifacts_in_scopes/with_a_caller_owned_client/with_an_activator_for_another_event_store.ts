// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '@cratis/arc.core';
import type { ChronicleOptions, IChronicleClient } from '@cratis/chronicle';
import { ArcApplicationBuilder } from '@cratis/arc.core';
import { chronicleArtifactActivator } from '../../../chronicleArtifactActivator.js';
import { withChronicle } from '../../../withChronicle.js';

describe('when activating artifacts in scopes with a caller-owned client whose activator serves another event store', () => {
    let failure: Error | undefined;
    beforeEach(() => {
        const artifactActivator = chronicleArtifactActivator(() => ({}) as ArcServer, 'Invoices');
        const client = { options: { artifactActivator } as unknown as ChronicleOptions } as IChronicleClient;
        try { withChronicle(new ArcApplicationBuilder(), { client, eventStore: 'Orders', activateArtifactsInScopes: true }); }
        catch (error) { failure = error as Error; }
    });
    it('should reject the registration', () => { failure!.message.should.contain('requires creating it with artifactActivator'); });
});
