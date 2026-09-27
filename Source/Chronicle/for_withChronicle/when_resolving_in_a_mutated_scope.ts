// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, Severity } from '@cratis/arc.core';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import { ChronicleReadModels } from '../ChronicleReadModels.js';
import '../index.js';

should();
describe('when resolving Chronicle read models in a mutated scope', () => {
    let namespace: string;
    beforeEach(async () => {
        const client = { getEventStore: async (_store: string, requested: string) => {
            namespace = requested;
            return {} as IEventStore;
        } } as unknown as IChronicleClient;
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ client, eventStore: 'Items' });
        const application = await builder.build();
        const identity = { tenantId: 'first', correlationId: crypto.randomUUID(), principal: undefined,
            signal: new AbortController().signal, allowedSeverity: Severity.Warning };
        const scope = application.server.services.createScope(identity);
        identity.tenantId = 'second';
        try { await (await scope.resolve(ChronicleReadModels)).getStore(); }
        finally { await scope.dispose(); await application.dispose(); }
    });
    it('should resolve the creation-time tenant namespace', () => namespace.should.equal('first'));
});
