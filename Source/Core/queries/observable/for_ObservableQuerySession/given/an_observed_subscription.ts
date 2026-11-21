// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { metrics, trace } from '@opentelemetry/api';
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import type { MetricData } from '@opentelemetry/sdk-metrics';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { z } from 'zod';
import { ArcServer } from '../../../../ArcServer.js';
import { ServiceLifetime } from '../../../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../../../dependencyInjection/ServiceToken.js';
import type { QueryRenderer } from '../../../QueryRenderer.js';
import { CurrentValueSubject } from '../../CurrentValueSubject.js';
import { defineObservableQuery } from '../../defineObservableQuery.js';
import type { ObservableQuerySession } from '../../ObservableQuerySession.js';
import { queryContext } from './a_query_context.js';

/** An observable subscription exported to in-memory telemetry; rendering the value 'bad' throws. */
export class an_observed_subscription {
    spanExporter!: InMemorySpanExporter;
    metricExporter!: InMemoryMetricExporter;
    tracerProvider!: BasicTracerProvider;
    meterProvider!: MeterProvider;
    server!: ArcServer;
    subject!: CurrentValueSubject<string>;
    session!: ObservableQuerySession;

    constructor() {
        beforeEach(async () => {
            this.spanExporter = new InMemorySpanExporter();
            this.tracerProvider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(this.spanExporter)] });
            trace.setGlobalTracerProvider(this.tracerProvider);
            this.metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
            this.meterProvider = new MeterProvider({ readers: [new PeriodicExportingMetricReader({
                exporter: this.metricExporter, exportIntervalMillis: 60_000
            })] });
            metrics.setGlobalMeterProvider(this.meterProvider);
            this.subject = new CurrentValueSubject('0');
            const renderer = serviceToken<QueryRenderer>('failing renderer');
            this.server = new ArcServer({
                services: [{ token: renderer, lifetime: ServiceLifetime.Scoped, factory: () => ({
                    canRender: () => true,
                    render: (value: unknown) => { if (value === 'bad') throw new Error('Rendering failed'); return value; }
                }) }],
                queryRenderers: [renderer],
                observableQueries: [defineObservableQuery({ name: 'Watch', schema: z.object({}), observe: () => this.subject })]
            });
            this.session = await this.server.openObservableQuery('Watch', {}, queryContext());
        });
        afterEach(async () => {
            await this.server.dispose();
            await this.meterProvider.shutdown();
            await this.tracerProvider.shutdown();
            trace.disable(); metrics.disable();
        });
    }

    async metric(name: string): Promise<MetricData | undefined> {
        await this.meterProvider.forceFlush();
        return this.metricExporter.getMetrics().at(-1)?.scopeMetrics
            .flatMap(scope => scope.metrics).find(metric => metric.descriptor.name === name);
    }
}
