// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ChronicleClient, ChronicleOptions, EventStoreNamespaceName } from '@cratis/chronicle';
import type { IEventStore } from '@cratis/chronicle';
import type { ExecutionContext } from '@cratis/arc.core';
import type { ChronicleRegistration } from './ChronicleOptions.js';
import type { ChronicleArtifacts } from './ChronicleArtifacts.js';

/** Select a trusted tenant namespace and own only clients created by this integration. */
export class ChronicleRuntime {
    readonly #client;
    readonly #owned;
    constructor(readonly options: ChronicleRegistration, artifacts: ChronicleArtifacts) {
        if (!options.eventStore) throw new Error('A Chronicle event store is required');
        this.#owned = !options.client;
        this.#client = options.client ?? new ChronicleClient(ChronicleOptions.fromConnectionString(options.connectionString!, {
            clientArtifactsProvider: artifacts, discoveryPatterns: []
        }));
    }
    /** Resolves the selected event store in the namespace authorized by Arc. */
    getStore(context: ExecutionContext): Promise<IEventStore> {
        return this.#client.getEventStore(this.options.eventStore, context.tenantId ?? EventStoreNamespaceName.default.value);
    }
    /** Close only an integration-owned client. */
    [Symbol.dispose](): void { if (this.#owned) this.#client.dispose(); }
}
