// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { MetricData } from '@opentelemetry/sdk-metrics';
import { z } from 'zod';
import { given } from '../../given.js';
import { ArcServer, defineQuery, defineObservableQuery, Severity, validation, WellKnownTelemetryNames } from '../../index.js';
import { a_telemetry_sdk } from '../given/a_telemetry_sdk.js';

for (const observable of [false, true]) {
    for (const [scenario, outcome, transport] of [
        ['denied', 'authorization', 'unknown'], ['invalid', 'validation', 'unknown'],
        ['throws', 'error', 'unknown'], ['aborted', 'cancelled', 'unknown'],
        ...observable ? [] : [['empty', 'success', 'snapshot']]
    ]) {
        describe(`when measuring ${observable ? 'an observable' : 'a snapshot'} query with ${scenario}`, given(a_telemetry_sdk, context => {
            let metrics: MetricData[];
            beforeEach(async () => {
                const controller = new AbortController();
                const definition = { name: 'Measured', schema: z.object({}),
                    authorize: () => scenario !== 'denied',
                    validate: () => scenario === 'invalid' ? [validation('Private validation message')] : [] };
                const perform = () => {
                    if (scenario === 'throws') throw new Error('Private failure');
                    if (scenario === 'aborted') controller.abort(new Error('Private cancellation reason'));
                    return undefined;
                };
                const server = new ArcServer(observable ? {
                    observableQueries: [defineObservableQuery({ ...definition, observe: () => {
                        perform();
                        throw new Error('No source');
                    } })]
                } : { queries: [defineQuery({ ...definition, perform })] });
                try {
                    await server.performQuery('Measured', {}, { correlationId: 'private-correlation', principal: undefined,
                        tenantId: 'private-tenant', signal: controller.signal, allowedSeverity: Severity.Warning });
                } finally { await server.dispose(); }
                await context.meterProvider.forceFlush();
                metrics = context.metricExporter.getMetrics().flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics);
            });
            it('should record one query execution with its outcome and result transport', () => {
                const metric = metrics.find(metric => metric.descriptor.name === WellKnownTelemetryNames.queryDuration)!;
                metric.dataPoints.should.have.lengthOf(1);
                metric.dataPoints[0]!.attributes.should.deep.equal({ 'cratis.arc.query.name': 'Measured',
                    'cratis.arc.query.outcome': outcome, 'cratis.arc.query.transport': transport });
                metric.dataPoints[0]!.value.should.have.property('count', 1);
            });
            it('should share the metric outcome and transport with the public query span', () => {
                const span = context.spanExporter.getFinishedSpans().find(span => span.name === WellKnownTelemetryNames.queryPerformSpan)!;
                span.attributes[WellKnownTelemetryNames.queryOutcome]!.should.equal(outcome);
                span.attributes[WellKnownTelemetryNames.queryTransport]!.should.equal(transport);
            });
        }));
    }
}
