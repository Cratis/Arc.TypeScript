// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, AuthenticationStatus, CommandValidator, validator, roles } from '@cratis/arc.core/fetch';
import { field } from '@cratis/fundamentals';
import { Submit } from './fetch-runtime-scenario/Submit.mjs';
import { Inventory } from './fetch-runtime-scenario/Inventory.mjs';

class SubmitValidator extends CommandValidator {
    constructor() {
        super();
        this.ruleFor(command => command.name).notEmpty();
    }
}
field(String)(Submit.prototype, 'name');
validator(Submit)(SubmitValidator);
roles('writer')(Submit);

/** Build the same Arc catalog for every Fetch host. */
export async function createScenarioApp() {
    const builder = ArcApplication.createBuilder({
        authentication: [request => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: request.headers.get('x-user') ?? 'reader',
                roles: request.headers.get('x-user') === 'writer' ? ['writer'] : [], isAuthenticated: true } })],
        tenancy: { required: true }
    });
    builder.add(Submit, SubmitValidator, Inventory);
    return builder.build();
}

/** Exercise the same HTTP behavior through a host dispatcher or directly against app.fetch. */
export async function runScenario(dispatch, { queryMethod = true } = {}) {
    const app = dispatch ? undefined : await createScenarioApp();
    const send = dispatch ?? (request => app.fetch(request));
    const base = 'https://fetch.example';
    const headers = { 'x-cratis-tenant-id': 'north', 'x-user': 'writer' };
    const request = (path, init = {}) => new Request(base + path, { ...init, headers: { ...headers, ...init.headers } });
    const check = (condition, message) => { if (!condition) throw Error(message); };
    const correlation = '11111111-1111-4111-8111-111111111111';
    try {
        const commandResponse = await send(request('/api/submit', { method: 'POST',
            headers: { 'content-type': 'application/json', 'x-correlation-id': correlation }, body: '{"name":"ok"}' }));
        check(commandResponse.status === 200 && (await commandResponse.json()).response === 'accepted', 'Command failed');
        check(commandResponse.headers.get('x-correlation-id') === correlation, 'Correlation header not preserved');
        const invalid = await send(request('/api/submit', { method: 'POST',
            headers: { 'content-type': 'application/json' }, body: '{"name":""}' }));
        check(invalid.status === 400 && (await invalid.json()).validationResults?.length > 0, 'Validation failure missing');
        const denied = await send(request('/api/submit', { method: 'POST',
            headers: { 'content-type': 'application/json', 'x-user': 'reader' }, body: '{"name":"ok"}' }));
        check(denied.status === 403, 'Authorization failed');
        const queryResponse = await send(request('/api/all'));
        check(queryResponse.status === 200 && JSON.stringify((await queryResponse.json()).data) === '["ready"]', 'GET query failed');
        const query = await send(request('/api/all', { method: 'QUERY',
            headers: { 'content-type': 'application/json' }, body: '{}' }));
        if (queryMethod) {
            check(query.status === 200 && JSON.stringify((await query.json()).data) === '["ready"]', 'QUERY method failed');
        } else {
            check(query.status === 400 && !query.headers.has('x-correlation-id'),
                `Next.js QUERY behavior changed (${query.status}: ${await query.text()})`);
        }
        const snapshot = await send(request('/api/live'));
        check(snapshot.status === 200 && JSON.stringify((await snapshot.json()).data) === '["ready"]', 'Observable snapshot failed');
        const tenant = await send(request('/api/tenant'));
        check(tenant.status === 200 && (await tenant.json()).data === 'north', 'Tenant header not resolved');
        const missingTenant = await send(new Request(base + '/api/all', { headers: { 'x-user': 'writer' } }));
        check(missingTenant.status === 400, 'Missing tenant accepted');
        const abort = new AbortController();
        const response = await send(request('/api/live', { headers: { accept: 'text/event-stream' }, signal: abort.signal }));
        check(response.status === 200 && response.body, 'SSE failed');
        const reader = response.body.getReader();
        try {
            check(new TextDecoder().decode((await reader.read()).value).includes('ready'), 'SSE emission failed');
            const active = await send(request('/api/active-streams'));
            const activeBody = await active.text();
            check(active.status === 200, `SSE subscription status failed (${active.status}: ${activeBody})`);
            const activeData = JSON.parse(activeBody);
            check(activeData.data?.count === 1, `SSE subscription was not active (${JSON.stringify(activeData)})`);
        } finally {
            abort.abort();
            await reader.cancel().catch(() => {});
        }
        let released = false;
        for (let attempt = 0; attempt < 25; attempt++) {
            const active = await send(request('/api/active-streams'));
            check(active.status === 200, 'SSE subscription status failed');
            if ((await active.json()).data?.count === 0) { released = true; break; }
            await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
        }
        check(released, 'SSE subscription not released after abort');
        const hubResponse = await send(request('/.cratis/queries/sse'));
        check(hubResponse.status === 200 && hubResponse.body, 'SSE hub failed');
        const events = hubResponse.body.getReader();
        try {
            const connected = JSON.parse(new TextDecoder().decode((await events.read()).value).slice(6));
            const subscribed = await send(request('/.cratis/queries/sse/subscribe', { method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ connectionId: connected.payload, queryId: 'inventory', revision: 1,
                    request: { queryName: 'Inventory.Live' } }) }));
            check(subscribed.status === 200 && new TextDecoder().decode((await events.read()).value).includes('ready'),
                'SSE hub subscription failed');
        } finally { await events.cancel(); }
        check((await send(request('/foreign'))).status === 404, 'Fetch fallthrough failed');
    } finally { if (app) await app.dispose(); }
}
