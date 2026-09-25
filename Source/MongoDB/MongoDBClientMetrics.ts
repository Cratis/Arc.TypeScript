// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { metrics } from '@opentelemetry/api';
import type { MongoClient } from 'mongodb';

/** Attach driver event instruments to Arc-owned MongoDB clients before connecting. */
export function monitorMongoDBClient(client: MongoClient, server: string): void {
    const meter = metrics.getMeter('Cratis.Arc.MongoDB');
    const open = meter.createUpDownCounter('mongodb-open-connections');
    const pool = meter.createUpDownCounter('mongodb-connections-in-pool');
    const commands = meter.createUpDownCounter('mongodb-commands');
    const failures = meter.createCounter('mongodb-failed-connections');
    const aggregate = meter.createCounter('mongodb-aggregated-commands');
    const labels = { Server: server };
    client.on('connectionCreated', () => { open.add(1, { ...labels, state: 'open' }); pool.add(1, labels); });
    client.on('connectionClosed', () => { open.add(-1, { ...labels, state: 'open' }); pool.add(-1, labels); });
    client.on('connectionCheckedOut', () => open.add(1, { ...labels, state: 'checked_out' }));
    client.on('connectionCheckedIn', () => open.add(-1, { ...labels, state: 'checked_out' }));
    client.on('connectionCheckOutFailed', () => failures.add(1, labels));
    client.on('commandStarted', () => { commands.add(1, labels); aggregate.add(1, labels); });
    client.on('commandSucceeded', () => commands.add(-1, labels));
    client.on('commandFailed', () => commands.add(-1, labels));
}
