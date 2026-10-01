// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ResourceMetrics } from '@opentelemetry/sdk-metrics';
import { given } from '../../given.js';
import { WellKnownTelemetryNames } from '../../index.js';
import { a_telemetry_sdk } from '../given/a_telemetry_sdk.js';

describe('when measuring a command with a failing handler', given(a_telemetry_sdk, context => {
    let exported: ResourceMetrics[];
    let status: number;
    beforeEach(async () => {
        const response = await context.server.handle(new Request('http://localhost/api/fail', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
        }));
        status = response!.status;
        await context.meterProvider.forceFlush();
        exported = context.metricExporter.getMetrics();
    });
    it('should return the command failure', () => {
        status.should.equal(500);
    });
    it('should record exactly one command duration measurement despite the failure', () => {
        const metrics = exported.flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics)
            .filter(metric => metric.descriptor.name === WellKnownTelemetryNames.commandDuration);
        metrics.should.have.lengthOf(1);
        const points = metrics[0]!.dataPoints;
        points.should.have.lengthOf(1);
        points[0]!.attributes.should.deep.equal({ 'cratis.arc.command.type': 'Fail', 'cratis.arc.command.outcome': 'error' });
        points[0]!.value.should.have.property('count', 1);
        points[0]!.value.should.have.property('sum', 0.25);
    });
}));
