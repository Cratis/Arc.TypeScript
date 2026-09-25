// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, Severity } from '@cratis/arc.core';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import { accepted } from '../../for_ChronicleCommand/given/a_command_with_typed_ports.js';
import '../../index.js';
import { Item, ItemCreated } from './discovery/Artifacts.js';

export class a_discovered_application {
    readonly item = Object.assign(new Item(), { id: 'one', name: 'found' });
    readonly appended: object[] = [];
    readonly store = { eventTypes: { all: [ItemCreated] }, eventLog: {
        appendMany: async (events: object[]) => { this.appended.push(...events); return events.map(() => accepted()); }
    }, readModels: { getInstances: async () => [this.item] } } as unknown as IEventStore;
    readonly client = { getEventStore: async () => this.store } as unknown as IChronicleClient;

    async exercise() {
        this.appended.length = 0;
        const builder = ArcApplication.createBuilder();
        await builder.discover(new URL('./discovery/', import.meta.url));
        builder.withChronicle({ client: this.client, eventStore: 'Items' });
        const application = await builder.build();
        try {
            const context = { tenantId: 'tenant', correlationId: crypto.randomUUID(), principal: undefined,
                signal: new AbortController().signal, allowedSeverity: Severity.Warning };
            const command = await application.server.executeCommand('CreateItem', { id: 'one' }, context);
            const query = await application.server.performQuery('Item.all', {}, context);
            return { command, query };
        } finally { await application.dispose(); }
    }
}
