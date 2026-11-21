// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { MetricData } from '@opentelemetry/sdk-metrics';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { given } from '../../../../given.js';
import { WellKnownTelemetryNames } from '../../../../execution/WellKnownTelemetryNames.js';
import { an_observed_subscription } from '../given/an_observed_subscription.js';

describe('when emitting many updates and the subscription is closed', given(an_observed_subscription, context => {
    let spans: ReadableSpan[];
    let emissions: MetricData | undefined;
    beforeEach(async () => {
        const stream = context.session.results();
        await stream.next();
        context.subject.next('1');
        await stream.next();
        await context.session.close();
        context.subject.next('2');
        context.subject.next('3');
        spans = context.spanExporter.getFinishedSpans();
        emissions = await context.metric(WellKnownTelemetryNames.queryEmissions);
    });
    it('should end the subscription span', () =>
        spans.map(span => span.name).should.include(WellKnownTelemetryNames.querySubscribeSpan));
    it('should count only the delivered emissions', () => emissions!.dataPoints[0]!.value.should.equal(2));
    it('should not start emission spans', () =>
        spans.filter(span => span.name === WellKnownTelemetryNames.queryEmissionSpan).should.be.empty);
}));
