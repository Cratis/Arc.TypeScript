// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { MetricData } from '@opentelemetry/sdk-metrics';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { given } from '../../../../given.js';
import { WellKnownTelemetryNames } from '../../../../execution/WellKnownTelemetryNames.js';
import type { QueryResult } from '../../../QueryResult.js';
import { an_observed_subscription } from '../given/an_observed_subscription.js';

describe('when emitting many updates and rendering an update fails', given(an_observed_subscription, context => {
    let failed: QueryResult;
    let ended: boolean;
    let spans: ReadableSpan[];
    let emissions: MetricData | undefined;
    beforeEach(async () => {
        const stream = context.session.results();
        await stream.next();
        context.subject.next('bad');
        failed = (await stream.next()).value!;
        ended = (await stream.next()).done === true;
        await context.session.close();
        spans = context.spanExporter.getFinishedSpans();
        emissions = await context.metric(WellKnownTelemetryNames.queryEmissions);
    });
    it('should deliver the rendering failure', () => failed.hasExceptions.should.be.true);
    it('should end the stream', () => ended.should.be.true);
    it('should count the attempted emissions', () => emissions!.dataPoints[0]!.value.should.equal(2));
    it('should not start emission spans', () =>
        spans.filter(span => span.name === WellKnownTelemetryNames.queryEmissionSpan).should.be.empty);
}));
