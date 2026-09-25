// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, AuthenticationStatus } from '@cratis/arc.core/fetch';
import { Submit } from './fetch-runtime-scenario/Submit.mjs';
import { Inventory } from './fetch-runtime-scenario/Inventory.mjs';

/** Exercise Fetch command, query and SSE transport against the actual runtime globals. */
export async function runScenario() {
    const builder = ArcApplication.createBuilder({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
        principal: { id: 'reader', roles: [], isAuthenticated: true } })] });
    builder.add(Submit, Inventory);
    const app = await builder.build();
    try {
        const commandResponse = await app.fetch(new Request('https://fetch.example/api/submit', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
        }));
        if (commandResponse.status !== 200 || (await commandResponse.json()).response !== 'accepted') throw Error('Command failed');
        const queryResponse = await app.fetch(new Request('https://fetch.example/api/all'));
        if (queryResponse.status !== 200 || JSON.stringify((await queryResponse.json()).data) !== '["ready"]') throw Error('Query failed');
        const response = await app.fetch(new Request('https://fetch.example/api/live', { headers: { accept: 'text/event-stream' } }));
        if (response.status !== 200) throw Error('SSE failed');
        const reader = response.body.getReader();
        if (!new TextDecoder().decode((await reader.read()).value).includes('ready')) throw Error('SSE emission failed');
        await reader.cancel();
        const hub = await app.fetch(new Request('https://fetch.example/.cratis/queries/sse'));
        if (hub.status !== 200) throw Error('SSE hub failed');
        const events = hub.body.getReader();
        const connected = JSON.parse(new TextDecoder().decode((await events.read()).value).slice(6));
        const subscribed = await app.fetch(new Request('https://fetch.example/.cratis/queries/sse/subscribe', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ connectionId: connected.payload, queryId: 'inventory', revision: 1,
                request: { queryName: 'Inventory.Live' } })
        }));
        if (subscribed.status !== 200 || !new TextDecoder().decode((await events.read()).value).includes('ready'))
            throw Error('SSE hub subscription failed');
        await events.cancel();
        if ((await app.fetch(new Request('https://fetch.example/foreign'))).status !== 404) throw Error('Fetch fallthrough failed');
    } finally { await app.dispose(); }
}
