// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ResourceMetrics } from '@opentelemetry/sdk-metrics';
import { given } from '../../given.js';
import { Severity, WellKnownTelemetryNames } from '../../index.js';
import { a_telemetry_sdk } from '../given/a_telemetry_sdk.js';

describe('when measuring an observable query with multiple emissions', given(a_telemetry_sdk, context => {
    let exported: ResourceMetrics[];
    beforeEach(async () => {
        const session = await context.server.openObservableQuery('Watch', {}, {
            correlationId: '11111111-1111-4111-8111-111111111111', principal: undefined,
            tenantId: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Warning
        });
        try {
            await session.current();
            await session.current();
        } finally { await session.close(); }
        await context.meterProvider.forceFlush();
        exported = context.metricExporter.getMetrics();
    });
    it('should record exactly one query duration measurement for the observable source open', () => {
        const metrics = exported.flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics)
            .filter(metric => metric.descriptor.name === WellKnownTelemetryNames.queryDuration);
        metrics.should.have.lengthOf(1);
        const points = metrics[0]!.dataPoints;
        points.should.have.lengthOf(1);
        points[0]!.attributes.should.deep.equal({ 'cratis.arc.query.name': 'Watch' });
        points[0]!.value.should.have.property('count', 1);
        points[0]!.value.should.have.property('sum', 0.25);
    });
    it('should retain both emission measurements only in the deprecated operation duration', () => {
        const legacy = exported.flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics)
            .find(metric => metric.descriptor.name === WellKnownTelemetryNames.operationDuration)!;
        const point = legacy.dataPoints.find(point => point.attributes.operation === 'cratis.arc.query.emission')!;
        point.value.should.have.property('count', 2);
    });
}));
