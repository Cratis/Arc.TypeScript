// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { setInterval, clearInterval } from 'node:timers';
import { test } from 'node:test';
import { ArcApplication, Severity } from '@cratis/arc.core';
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';
import { ChronicleArtifacts } from '../dist/ChronicleArtifacts.js';
import '../dist/index.js';
import * as routed from '../dist/Integration/EventSourceRoutingArtifacts.js';

const connectionString = process.env.ARC_CHRONICLE_TEST_URL;
if (!connectionString) throw new Error('ARC_CHRONICLE_TEST_URL is required; do not silently skip the kernel suite');
// The SDK's gRPC streams are unreferenced, so keep the runner alive while a check awaits the kernel.
const keepAlive = setInterval(() => {}, 1000);
const storeName = `ArcTsRouting${randomUUID().replaceAll('-', '')}`;
const tenant = 'RoutingTenant';
const artifacts = new ChronicleArtifacts();
const commands = [routed.DepositRouted, routed.DepositAndPostRouted, routed.DepositAndPostElsewhere, routed.CreditRoutedWallet];
for (const type of [routed.RoutedFundsDeposited, routed.RoutedAccount, routed.RoutedLedger, ...commands]) artifacts.register(type);
const client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString, {
    clientArtifactsProvider: artifacts, discoveryPatterns: []
}));
const builder = ArcApplication.createBuilder({ development: true });
builder.withChronicle({ client, eventStore: storeName });
builder.add(routed.RoutedFundsDeposited, routed.RoutedAccount, routed.RoutedLedger, ...commands);
const application = await builder.build();
const execute = (name, id) => application.server.executeCommand(name, { id }, {
    tenantId: tenant, correlationId: randomUUID(), principal: undefined,
    signal: new globalThis.AbortController().signal, allowedSeverity: Severity.Warning
});
const read = async id => (await client.getEventStore(storeName, tenant)).eventLog.getForEventSourceIdAndEventTypes(id, [routed.RoutedFundsDeposited]);

try {
    const checks = [];
    checks.push(test('a command routes its event through the declared definition and stream', async () => {
        const id = randomUUID();
        const result = await execute('DepositRouted', id);
        assert.equal(result.isSuccess, true, JSON.stringify(result));
        const [event] = await read(id);
        assert.equal(event.context.eventSource, 'ArcTypeScriptRoutedAccount');
        assert.equal(event.context.eventSourceType, 'ArcTypeScriptRoutedAccount');
        assert.equal(event.context.eventStreamType, 'Transactions');
        assert.equal((await execute('DepositRouted', id)).isSuccess, true, 'the definition-derived guard accepts the next append');
        assert.equal((await read(id)).length, 2);
    }));
    checks.push(test('an event naming its own definition replaces the command definition as a unit', async () => {
        const id = randomUUID();
        const result = await execute('DepositAndPostElsewhere', id);
        assert.equal(result.isSuccess, true, JSON.stringify(result));
        const [account] = await read(id);
        assert.equal(account.context.eventSource, 'ArcTypeScriptRoutedAccount');
        const [ledger] = await read(`${id}-ledger`);
        assert.equal(ledger.context.eventSource, 'ArcTypeScriptRoutedLedger');
        assert.equal(ledger.context.eventStreamType, 'Postings');
    }));
    checks.push(test('incompatible automatic guards on one event source id fail closed', async () => {
        const id = randomUUID();
        const result = await execute('DepositAndPostRouted', id);
        assert.match(result.exceptionMessages.join(), /needs differing concurrency guards/);
        assert.equal(result.isSuccess, false, 'Arc must not defeat the native client guard');
        assert.equal((await read(id)).length, 0, 'nothing is appended');
    }));
    checks.push(test('an aggregate rehydrates only its declared source and stream', async () => {
        const id = randomUUID();
        for (let expected = 0; expected < 3; expected++) {
            const result = await execute('CreditRoutedWallet', id);
            assert.equal(result.isSuccess, true, JSON.stringify(result));
            assert.equal((await read(id)).at(-1).content.note, `seen-${expected}`);
        }
        const events = await read(id);
        assert.deepEqual(new Set(events.map(event => event.context.eventSource)), new Set(['ArcTypeScriptRoutedAccount']));
        assert.deepEqual(new Set(events.map(event => event.context.eventStreamType)), new Set(['Transactions']));
    }));
    await Promise.all(checks);
} finally {
    await application.dispose();
    client.dispose();
    clearInterval(keepAlive);
}
