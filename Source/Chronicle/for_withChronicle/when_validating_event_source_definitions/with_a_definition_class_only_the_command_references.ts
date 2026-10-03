// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, Severity } from '@cratis/arc.core';
import { given } from '../../given.js';
import { ChronicleRuntime } from '../../ChronicleRuntime.js';
import { Account, Deposit } from '../../given/event_source_routing.js';

describe('when a command is the only reference to a definition class', given(class {}, () => {
    it('should register the class as an artifact so discovery needs no separate step', async () => {
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Accounts', connectionString: 'chronicle://localhost:1' });
        builder.add(Deposit);
        const app = await builder.build();
        try {
            const scope = app.server.services.createScope({ tenantId: 'tenant', correlationId: crypto.randomUUID(),
                principal: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Error });
            try { (await scope.resolve(ChronicleRuntime)).artifacts.eventSources.should.deep.equal([Account]); }
            finally { await scope.dispose(); }
        } finally { await app.dispose(); }
    });
}));
