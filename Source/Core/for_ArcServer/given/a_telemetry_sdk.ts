// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { metrics, trace } from '@opentelemetry/api';
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import sinon from 'sinon';
import { z } from 'zod';
import { ArcServer, defineCommand, defineQuery } from '../../index.js';

export class a_telemetry_sdk {
    spanExporter!: InMemorySpanExporter;
    metricExporter!: InMemoryMetricExporter;
    tracerProvider!: BasicTracerProvider;
    meterProvider!: MeterProvider;
    server!: ArcServer;
    clock = 0;

    constructor() {
        beforeEach(() => {
            this.clock = 0;
            sinon.stub(performance, 'now').callsFake(() => this.clock);
            this.spanExporter = new InMemorySpanExporter();
            this.tracerProvider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(this.spanExporter)] });
            trace.setGlobalTracerProvider(this.tracerProvider);
            this.metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
            this.meterProvider = new MeterProvider({ readers: [new PeriodicExportingMetricReader({
                exporter: this.metricExporter, exportIntervalMillis: 60_000
            })] });
            metrics.setGlobalMeterProvider(this.meterProvider);
            this.server = new ArcServer({
                commands: [defineCommand({ name: 'Echo', schema: z.object({}), handle: () => { this.clock += 250; return 'ok'; } })],
                queries: [defineQuery({ name: 'Items', schema: z.object({}), perform: () => { this.clock += 250; return [1]; } })]
            });
        });
        afterEach(async () => {
            await this.server.dispose();
            await this.meterProvider.shutdown();
            await this.tracerProvider.shutdown();
            trace.disable(); metrics.disable(); sinon.restore();
        });
    }
}
