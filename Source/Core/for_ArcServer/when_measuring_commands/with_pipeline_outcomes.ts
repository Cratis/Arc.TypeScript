// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { MetricData } from '@opentelemetry/sdk-metrics';
import { z } from 'zod';
import { given } from '../../given.js';
import { ArcServer, defineCommand, denied, rejected, Severity, validation, WellKnownTelemetryNames } from '../../index.js';
import { a_telemetry_sdk } from '../given/a_telemetry_sdk.js';

for (const [scenario, expected] of [
    ['denied', 'authorization'], ['invalid', 'validation'], ['constraintViolation', 'append_rejected'],
    ['concurrencyViolation', 'append_rejected'], ['aborted', 'cancelled'], ['completed_before_abort', 'success']
]) {
    describe(`when measuring a command with ${scenario}`, given(a_telemetry_sdk, context => {
        let metrics: MetricData[];
        beforeEach(async () => {
            const controller = new AbortController();
            const server = new ArcServer({ commands: [defineCommand({ name: 'Measured', schema: z.object({}),
                handle: () => {
                    if (scenario === 'denied') return denied();
                    if (scenario === 'aborted') { controller.abort(); throw new Error('Private cancellation reason'); }
                    if (scenario === 'completed_before_abort') { controller.abort(); return; }
                    return rejected(validation('Private validation message', ['private-member'], scenario));
                }
            })] });
            try {
                await server.executeCommand('Measured', {}, { correlationId: 'private-correlation', principal: undefined,
                    tenantId: 'private-tenant', signal: controller.signal, allowedSeverity: Severity.Warning });
            } finally { await server.dispose(); }
            await context.meterProvider.forceFlush();
            metrics = context.metricExporter.getMetrics().flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics);
        });
        it('should classify the command duration with only bounded attributes', () => {
            const point = metrics.find(metric => metric.descriptor.name === WellKnownTelemetryNames.commandDuration)!.dataPoints[0]!;
            point.attributes.should.deep.equal({ 'cratis.arc.command.type': 'Measured', 'cratis.arc.command.outcome': expected });
            point.value.should.have.property('count', 1);
        });
        it('should count the command exactly once with the same outcome', () => {
            const point = metrics.find(metric => metric.descriptor.name === WellKnownTelemetryNames.commandOutcomes)!.dataPoints[0]!;
            point.attributes.should.deep.equal({ 'cratis.arc.command.type': 'Measured', 'cratis.arc.command.outcome': expected });
            point.value.should.equal(1);
        });
        it('should put the outcome on the public command execution span', () => {
            context.spanExporter.getFinishedSpans().find(span => span.name === WellKnownTelemetryNames.commandExecuteSpan)!
                .attributes[WellKnownTelemetryNames.commandOutcome]!.should.equal(expected);
        });
    }));
}
