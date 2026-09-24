// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { context, metrics, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
should();

describe('when tracing an HTTP query with an application SDK', () => {
    let spans: ReturnType<InMemorySpanExporter['getFinishedSpans']>;
    let metricCount: number;
    beforeEach(async () => {
        const exporter = new InMemorySpanExporter();
        const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
        trace.setGlobalTracerProvider(provider);
        context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
        const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
        const meterProvider = new MeterProvider({ readers: [new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 60_000 })] });
        metrics.setGlobalMeterProvider(meterProvider);
        const server = new ArcServer({ queries: [defineQuery({ name: 'Items', schema: z.object({}), perform: () => [1] })] });
        try {
            await server.handle(new Request('http://localhost/api/items', {
                headers: { 'X-Correlation-ID': '11111111-1111-4111-8111-111111111111' }
            }));
            spans = exporter.getFinishedSpans();
            await meterProvider.forceFlush();
            metricCount = metricExporter.getMetrics().flatMap(metric => metric.scopeMetrics).flatMap(scope => scope.metrics).length;
        } finally {
            await server.dispose();
            await meterProvider.shutdown();
            await provider.shutdown();
            trace.disable(); metrics.disable(); context.disable();
        }
    });
    it('should produce a request and nested pipeline span with correlation', () => {
        spans.map(span => span.name).should.include.members(['cratis.arc.http.handle', 'cratis.arc.query.perform']);
        String(spans.find(span => span.name === 'cratis.arc.query.perform')!.attributes['cratis.correlation_id'])
            .should.equal('11111111-1111-4111-8111-111111111111');
    });
    it('should record a pipeline duration', () => { metricCount.should.be.greaterThan(0); });
});
