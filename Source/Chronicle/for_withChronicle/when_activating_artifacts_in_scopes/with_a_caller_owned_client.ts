// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IChronicleClient } from '@cratis/chronicle';
import { ArcApplicationBuilder } from '@cratis/arc.core';
import { withChronicle } from '../../withChronicle.js';

describe('when activating artifacts in scopes with a caller-owned client', () => {
    let failure: Error | undefined;
    beforeEach(() => {
        const client = {} as IChronicleClient;
        try { withChronicle(new ArcApplicationBuilder(), { client, eventStore: 'Orders', activateArtifactsInScopes: true } as never); }
        catch (error) { failure = error as Error; }
    });
    it('should reject the registration', () => { failure!.message.should.contain('requires an Arc-owned connection'); });
});
