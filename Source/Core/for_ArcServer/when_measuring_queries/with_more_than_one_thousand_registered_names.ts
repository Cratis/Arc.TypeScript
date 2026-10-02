// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { MetricData } from '@opentelemetry/sdk-metrics';
import { z } from 'zod';
import { given } from '../../given.js';
import { ArcServer, CurrentValueSubject, defineCommand, defineObservableQuery, Severity, WellKnownTelemetryNames } from '../../index.js';
import { a_telemetry_sdk } from '../given/a_telemetry_sdk.js';

describe('when measuring more than one thousand registered command and query names', given(a_telemetry_sdk, context => {
    let metrics: MetricData[];
    beforeEach(async () => {
        const names = Array.from({ length: 1002 }, (_, index) => `Name${index}`);
        const server = new ArcServer({
            commands: names.map(name => defineCommand({ name, schema: z.object({}), handle: () => undefined })),
            observableQueries: names.map(name => defineObservableQuery({ name: `Query${name}`, schema: z.object({}),
                observe: () => CurrentValueSubject.of(1) }))
        });
        const execution = { correlationId: 'private', principal: undefined, tenantId: 'private',
            signal: new AbortController().signal, allowedSeverity: Severity.Warning };
        try {
            for (const name of [...names, names[0]!]) {
                await server.executeCommand(name, {}, execution);
                const session = await server.openObservableQuery(`Query${name}`, {}, execution);
                await session.close();
            }
        } finally { await server.dispose(); }
        await context.meterProvider.forceFlush();
        metrics = context.metricExporter.getMetrics().flatMap(resource => resource.scopeMetrics).flatMap(scope => scope.metrics);
    });
    it('should fold command names past the limit into the same overflow series for the histogram and counter', () => {
        for (const name of [WellKnownTelemetryNames.commandDuration, WellKnownTelemetryNames.commandOutcomes]) {
            const points = metrics.find(metric => metric.descriptor.name === name)!.dataPoints;
            points.should.have.lengthOf(1001);
            const overflow = points.find(point => point.attributes[WellKnownTelemetryNames.commandType] === '_other')!;
            if (name === WellKnownTelemetryNames.commandDuration) overflow.value.should.have.property('count', 2);
            else overflow.value.should.equal(2);
        }
    });
    it('should share the bounded query names between query and subscription duration including the deprecated key', () => {
        for (const name of [WellKnownTelemetryNames.queryDuration, WellKnownTelemetryNames.subscriptionDuration]) {
            const points = metrics.find(metric => metric.descriptor.name === name)!.dataPoints;
            points.should.have.lengthOf(1001);
            const overflow = points.find(point => point.attributes[WellKnownTelemetryNames.queryName] === '_other')!;
            overflow.value.should.have.property('count', 2);
            if (name === WellKnownTelemetryNames.subscriptionDuration) overflow.attributes.query_name!.should.equal('_other');
            points.find(point => point.attributes[WellKnownTelemetryNames.queryName] === 'QueryName0')!.value.should.have.property('count', 2);
        }
    });
}));
