// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { context, metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
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
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Watch', schema: z.object({}), observe: () => CurrentValueSubject.of([1])
        })], queries: [
            defineQuery({ name: 'Items', schema: z.object({}), perform: () => [1] }),
            defineQuery({ name: 'PrivateFailure', schema: z.object({}), perform: () => { throw new Error('secret trace detail'); } })
        ] });
        try {
            await server.handle(new Request('http://localhost/api/items', {
                headers: { 'X-Correlation-ID': '11111111-1111-4111-8111-111111111111' }
            }));
            await server.handle(new Request('http://localhost/api/private-failure'));
            const session = await server.openObservableQuery('Watch', {}, {
                correlationId: '11111111-1111-4111-8111-111111111111', principal: undefined,
                tenantId: undefined, signal: new AbortController().signal, allowedSeverity: 2
            });
            await session.current();
            await session.close();
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
    it('should use snake-case .NET parameter tags and internal HTTP spans', () => {
        spans.filter(span => span.name === 'cratis.arc.query.perform').map(span => span.attributes.query_name)
            .should.include('Items');
        String(spans.find(span => span.name === 'cratis.arc.query.filter')!.attributes.query_name).should.equal('Items');
        spans.find(span => span.name === 'cratis.arc.http.handle')!.kind.should.equal(SpanKind.INTERNAL);
    });
    it('should mark returned failure results as errors without recording exception messages', () => {
        const failed = spans.find(span => span.name === 'cratis.arc.query.perform' && span.attributes.query_name === 'PrivateFailure')!;
        failed.status.code.should.equal(SpanStatusCode.ERROR);
        spans.find(span => span.name === 'cratis.arc.http.handle' && span.attributes['http.route'] === '/api/private-failure')!
            .status.code.should.equal(SpanStatusCode.ERROR);
        JSON.stringify(spans.map(span => ({ attributes: span.attributes, events: span.events, status: span.status })))
            .should.not.include('secret trace detail');
    });
    it('should parent observable perform and emission spans under a completed subscription', () => {
        const parent = spans.find(span => span.name === 'cratis.arc.query.subscribe')!;
        spans.filter(span => span.name === 'cratis.arc.query.perform' && span.attributes.query_name === 'Watch' ||
            span.name === 'cratis.arc.query.emission').map(span => span.parentSpanContext?.spanId)
            .should.deep.equal([parent.spanContext().spanId, parent.spanContext().spanId]);
    });
    it('should record a pipeline duration', () => { metricCount.should.be.greaterThan(0); });
});
