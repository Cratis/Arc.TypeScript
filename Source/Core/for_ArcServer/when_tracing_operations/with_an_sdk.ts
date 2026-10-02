// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { context, metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader, type ResourceMetrics } from '@opentelemetry/sdk-metrics';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
should();

describe('when tracing an HTTP query with an application SDK', () => {
    let spans: ReturnType<InMemorySpanExporter['getFinishedSpans']>;
    let exported: ResourceMetrics[];
    beforeEach(async () => {
        const exporter = new InMemorySpanExporter();
        const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
        trace.setGlobalTracerProvider(provider);
        context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
        const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
        const meterProvider = new MeterProvider({ readers: [new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 60_000 })] });
        metrics.setGlobalMeterProvider(meterProvider);
        const server = new ArcServer({ commands: [defineCommand({
            name: 'Echo', schema: z.object({}), handle: () => 'ok'
        })], observableQueries: [defineObservableQuery({
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
            await server.handle(new Request('http://localhost/api/echo', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
            }));
            await server.handle(new Request('http://localhost/api/echo/validate', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
            }));
            const session = await server.openObservableQuery('Watch', {}, {
                correlationId: '11111111-1111-4111-8111-111111111111', principal: undefined,
                tenantId: undefined, signal: new AbortController().signal, allowedSeverity: 2
            });
            await session.current();
            await session.close();
            spans = exporter.getFinishedSpans();
            await meterProvider.forceFlush();
            exported = metricExporter.getMetrics();
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
    it('should carry the canonical command type on filter and validate spans', () => {
        for (const name of ['cratis.arc.command.filter', 'cratis.arc.command.validate']) {
            const matching = spans.filter(span => span.name === name);
            matching.length.should.be.greaterThan(0);
            for (const span of matching) span.attributes['cratis.arc.command.type']!.should.equal('Echo');
        }
    });
    it('should carry the canonical query name on filter spans', () => {
        const matching = spans.filter(span => span.name === 'cratis.arc.query.filter');
        matching.length.should.be.greaterThan(0);
        for (const span of matching) span.attributes['cratis.arc.query.name']!.should.equal(span.attributes.query_name);
        matching.map(span => span.attributes['cratis.arc.query.name']).should.include('Items');
    });
    it('should carry the canonical query name on subscription and emission spans', () => {
        for (const name of ['cratis.arc.query.subscribe', 'cratis.arc.query.emission']) {
            const matching = spans.filter(span => span.name === name);
            matching.length.should.be.greaterThan(0);
            for (const span of matching) span.attributes['cratis.arc.query.name']!.should.equal('Watch');
        }
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
    it('should record a pipeline duration', () => {
        exported.flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics).length.should.be.greaterThan(0);
    });
    it('should export second-scale subscription duration buckets', () => {
        const metric = exported.flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics)
            .find(metric => metric.descriptor.name === 'cratis.arc.subscription.duration')!;
        metric.dataPoints.should.have.lengthOf(1);
        metric.dataPoints[0]!.value.should.have.nested.property('buckets.boundaries').that.deep.equals([
            0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10
        ]);
    });
});
