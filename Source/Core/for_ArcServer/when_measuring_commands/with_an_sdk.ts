// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DataPointType, type ResourceMetrics } from '@opentelemetry/sdk-metrics';
import { given } from '../../given.js';
import packageMetadata from '../../package.json' with { type: 'json' };
import { WellKnownTelemetryNames } from '../../index.js';
import { a_telemetry_sdk } from '../given/a_telemetry_sdk.js';

describe('when measuring a command with an SDK', given(a_telemetry_sdk, context => {
    let exported: ResourceMetrics[];
    beforeEach(async () => {
        await context.server.handle(new Request('http://localhost/api/echo', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
        }));
        await context.meterProvider.forceFlush();
        exported = context.metricExporter.getMetrics();
    });
    it('should record command duration as a histogram in seconds with a description', () => {
        const metric = exported.flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics)
            .find(metric => metric.descriptor.name === WellKnownTelemetryNames.commandDuration)!;
        metric.descriptor.name.should.equal('cratis.arc.command.duration');
        metric.dataPointType.should.equal(DataPointType.HISTOGRAM);
        metric.descriptor.unit.should.equal('s');
        metric.descriptor.description.length.should.be.greaterThan(0);
        metric.dataPoints[0]!.value.should.have.property('sum', 0.25);
    });
    it('should export second-scale buckets for command and deprecated operation durations', () => {
        for (const name of [WellKnownTelemetryNames.commandDuration, WellKnownTelemetryNames.operationDuration]) {
            const metric = exported.flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics)
                .find(metric => metric.descriptor.name === name)!;
            metric.dataPoints.length.should.be.greaterThan(0);
            for (const point of metric.dataPoints) {
                point.value.should.have.nested.property('buckets.boundaries').that.deep.equals([
                    0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10
                ]);
            }
        }
    });
    it('should use only the canonical command type and outcome attributes shared with spans', () => {
        const metric = exported.flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics)
            .find(metric => metric.descriptor.name === WellKnownTelemetryNames.commandDuration)!;
        metric.dataPoints[0]!.attributes.should.deep.equal({ 'cratis.arc.command.type': 'Echo', 'cratis.arc.command.outcome': 'success' });
        context.spanExporter.getFinishedSpans().find(span => span.name === 'cratis.arc.command.execute')!
            .attributes['cratis.arc.command.type']!.should.equal('Echo');
    });
    it('should count one successful command with the same attributes as its duration', () => {
        const metrics = exported.flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics);
        const counter = metrics.find(metric => metric.descriptor.name === WellKnownTelemetryNames.commandOutcomes)!;
        counter.descriptor.name.should.equal('cratis.arc.command.outcomes');
        counter.descriptor.unit.should.equal('{command}');
        counter.descriptor.description.length.should.be.greaterThan(0);
        counter.dataPointType.should.equal(DataPointType.SUM);
        counter.dataPoints[0]!.value.should.equal(1);
        counter.dataPoints[0]!.attributes.should.deep.equal({ 'cratis.arc.command.type': 'Echo', 'cratis.arc.command.outcome': 'success' });
    });
    it('should continue recording the deprecated duration with its original attributes', () => {
        const legacy = exported.flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics)
            .find(metric => metric.descriptor.name === WellKnownTelemetryNames.operationDuration)!;
        legacy.descriptor.name.should.equal('cratis.arc.operation.duration');
        const execution = legacy.dataPoints.find(point => point.attributes.operation === 'cratis.arc.command.execute')!;
        execution.attributes.should.deep.equal({ operation: 'cratis.arc.command.execute', command_type: 'Echo' });
        execution.value.should.have.property('sum', 0.25);
    });
    it('should identify tracer and meter scopes with the core package version', () => {
        const span = context.spanExporter.getFinishedSpans().find(span => span.name === 'cratis.arc.command.execute')!;
        span.instrumentationScope.should.deep.equal({ name: 'Cratis.Arc', version: packageMetadata.version, schemaUrl: undefined });
        const scope = exported.flatMap(resource => resource.scopeMetrics)
            .find(scope => scope.metrics.some(metric => metric.descriptor.name === WellKnownTelemetryNames.commandDuration))!;
        scope.scope.name.should.equal('Cratis.Arc');
        scope.scope.version!.should.equal(packageMetadata.version);
    });
}));
