// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ResourceMetrics } from '@opentelemetry/sdk-metrics';
import { given } from '../../given.js';
import { WellKnownTelemetryNames } from '../../index.js';
import { a_telemetry_sdk } from '../given/a_telemetry_sdk.js';

describe('when measuring a command with a validate-only request', given(a_telemetry_sdk, context => {
    let exported: ResourceMetrics[];
    let status: number;
    beforeEach(async () => {
        const response = await context.server.handle(new Request('http://localhost/api/echo/validate', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
        }));
        status = response!.status;
        await context.meterProvider.forceFlush();
        exported = context.metricExporter.getMetrics();
    });
    it('should complete the validation request', () => {
        status.should.equal(200);
    });
    it('should record validation but no command execution duration points', () => {
        const metrics = exported.flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics);
        const legacy = metrics.find(metric => metric.descriptor.name === WellKnownTelemetryNames.operationDuration)!;
        legacy.dataPoints.filter(point => point.attributes.operation === 'cratis.arc.command.validate')
            .should.have.lengthOf(1);
        metrics.filter(metric => metric.descriptor.name === WellKnownTelemetryNames.commandDuration)
            .reduce((count, metric) => count + metric.dataPoints.length, 0).should.equal(0);
    });
}));
