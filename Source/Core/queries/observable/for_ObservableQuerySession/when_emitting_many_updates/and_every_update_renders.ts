// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { MetricData } from '@opentelemetry/sdk-metrics';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { given } from '../../../../given.js';
import { WellKnownTelemetryNames } from '../../../../execution/WellKnownTelemetryNames.js';
import { an_observed_subscription } from '../given/an_observed_subscription.js';

const updates = 50;

describe('when emitting many updates and every update renders', given(an_observed_subscription, context => {
    let spans: ReadableSpan[];
    let emissions: MetricData | undefined;
    let legacy: MetricData | undefined;
    beforeEach(async () => {
        const stream = context.session.results();
        await stream.next();
        for (let update = 1; update < updates; update++) {
            context.subject.next(String(update));
            await stream.next();
        }
        await context.session.close();
        spans = context.spanExporter.getFinishedSpans();
        emissions = await context.metric(WellKnownTelemetryNames.queryEmissions);
        legacy = await context.metric(WellKnownTelemetryNames.operationDuration);
    });
    it('should keep the subscription trace to its admission spans', () => spans.map(span => span.name).should.have.members([
        WellKnownTelemetryNames.queryFilterSpan, WellKnownTelemetryNames.queryPerformSpan, WellKnownTelemetryNames.querySubscribeSpan]));
    it('should count every emission', () => emissions!.dataPoints[0]!.value.should.equal(updates));
    it('should count emissions by query name', () =>
        emissions!.dataPoints[0]!.attributes.should.deep.equal({ query_name: 'Watch', [WellKnownTelemetryNames.queryName]: 'Watch' }));
    it('should not record emissions in the deprecated operation duration', () =>
        legacy!.dataPoints.filter(point => point.attributes.operation === WellKnownTelemetryNames.queryEmissionSpan).should.be.empty);
}));
