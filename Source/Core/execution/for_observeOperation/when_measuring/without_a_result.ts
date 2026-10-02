// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { MetricData } from '@opentelemetry/sdk-metrics';
import { given } from '../../../given.js';
import { a_telemetry_sdk } from '../../../for_ArcServer/given/a_telemetry_sdk.js';
import { Severity, WellKnownTelemetryNames } from '../../../index.js';
import { observeOperation } from '../../observeOperation.js';

for (const aborted of [false, true]) {
    describe(`when measuring a thrown query failure with cancellation ${aborted}`, given(a_telemetry_sdk, context => {
        let metric: MetricData;
        let thrown: unknown;
        const failure = new Error('Private failure');
        beforeEach(async () => {
            const controller = new AbortController();
            if (aborted) controller.abort();
            try {
                await observeOperation(WellKnownTelemetryNames.queryPerformSpan, { correlationId: 'private', principal: undefined,
                    tenantId: undefined, allowedSeverity: Severity.Warning, signal: controller.signal }, 'Known',
                async () => { throw failure; });
            } catch (error) { thrown = error; }
            await context.meterProvider.forceFlush();
            metric = context.metricExporter.getMetrics().flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics)
                .find(metric => metric.descriptor.name === WellKnownTelemetryNames.queryDuration)!;
        });
        it('should preserve the original thrown failure', () => { (thrown === failure).should.equal(true); });
        it('should record unknown transport and distinguish cancellation from errors', () => {
            metric.dataPoints[0]!.attributes.should.deep.equal({ 'cratis.arc.query.name': 'Known',
                'cratis.arc.query.transport': 'unknown', 'cratis.arc.query.outcome': aborted ? 'cancelled' : 'error' });
            metric.dataPoints[0]!.value.should.have.property('count', 1);
        });
    }));
}
