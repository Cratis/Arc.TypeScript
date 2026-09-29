// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '@cratis/arc.core';
import '../../../index.js';
import { DiscoveredChronicleOnlyReactor } from './chronicle_only/Reactors.js';

type Builder = ReturnType<typeof ArcApplication.createBuilder>;

/** Discovers a Chronicle-only reactor before withChronicle over an Arc-owned connection; building never connects. */
export class a_discovered_chronicle_only_reactor {
    registered = false;

    async build(activateArtifactsInScopes: boolean): Promise<void> {
        const builder: Builder = ArcApplication.createBuilder();
        await builder.discover(new URL('./chronicle_only/', import.meta.url));
        builder.withChronicle({ connectionString: 'chronicle://localhost:35000', eventStore: 'Discovered', activateArtifactsInScopes });
        const application = await builder.build();
        try {
            this.registered = builder.services.registrations.some(registration => registration.token === DiscoveredChronicleOnlyReactor);
        } finally { await application.dispose(); }
    }
}
