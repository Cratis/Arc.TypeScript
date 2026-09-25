// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { metrics } from '@opentelemetry/api';
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { MongoClient } from 'mongodb';
import { given } from '../given.js';
import { MongoClientFactory } from '../MongoClientFactory.js';
import type { ExecutionContext } from '@cratis/arc.core';

should();
class an_owned_client {
    readonly exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
    readonly reader = new PeriodicExportingMetricReader({ exporter: this.exporter, exportIntervalMillis: 60000 });
    readonly provider = new MeterProvider({ readers: [this.reader] });
    readonly factory = new MongoClientFactory({ server: 'mongodb://user:secret@localhost:27017', readModels: [] });
    readonly context: ExecutionContext = { tenantId: 'default', signal: new AbortController().signal,
        allowedSeverity: 3, correlationId: 'test', principal: undefined };
}
describe('when instrumenting an owned client', given(an_owned_client, context => {
    let client: MongoClient;
    beforeEach(() => {
        metrics.setGlobalMeterProvider(context.provider);
        client = context.factory.get(context.context);
        client.emit('commandStarted', { commandName: 'find' } as never);
        client.emit('commandSucceeded', { commandName: 'find' } as never);
    });
    afterEach(async () => {
        await context.factory[Symbol.asyncDispose]();
        await context.provider.shutdown();
        metrics.disable();
    });
    it('should count commands with a server label', async () => {
        await context.reader.forceFlush();
        const instruments = context.exporter.getMetrics().flatMap(result => result.scopeMetrics.flatMap(scope => scope.metrics));
        const aggregate = instruments.find(instrument => instrument.descriptor.name === 'mongodb-aggregated-commands');
        aggregate!.dataPoints[0]!.value.should.equal(1);
        (aggregate!.dataPoints[0]!.attributes.Server as string).should.equal('localhost:27017');
    });
}));
