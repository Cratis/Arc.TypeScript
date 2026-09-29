// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IChronicleClient } from '@cratis/chronicle';
import { ArcApplicationBuilder } from '@cratis/arc.core';
import { withChronicle } from '../../../withChronicle.js';

describe('when activating artifacts in scopes with a caller-owned client without its activator', () => {
    let failure: Error | undefined;
    beforeEach(() => {
        const client = { options: {} } as IChronicleClient;
        try { withChronicle(new ArcApplicationBuilder(), { client, eventStore: 'Orders', activateArtifactsInScopes: true }); }
        catch (error) { failure = error as Error; }
    });
    it('should name the wiring the client needs', () => {
        failure!.message.should.contain("artifactActivator: chronicleArtifactActivator(server, 'Orders')");
    });
});
