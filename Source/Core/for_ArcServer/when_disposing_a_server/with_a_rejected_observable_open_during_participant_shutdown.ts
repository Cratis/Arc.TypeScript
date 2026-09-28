// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { trace } from '@opentelemetry/api';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline, captureFailure, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when an observable open fails during participant shutdown', () => {
    let finished: string[];
    beforeEach(async () => {
        const exporter = new InMemorySpanExporter();
        const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
        trace.setGlobalTracerProvider(provider);
        const entered = gate(); const release = gate();
        const server = new ArcServer({ observableQueries: [defineObservableQuery({ name: 'Pending',
            schema: z.object({}), observe: async () => {
                entered.release(); await release.promise; throw new Error('open failed');
            } })] });
        try {
            const opening = captureFailure(server.openObservableQuery('Pending', {}, observableExecution()));
            await beforeDeadline(entered.promise, 'pending query');
            server.services.addShutdownParticipant({ stop: () => { release.release(); }, drain: async () => { await opening; } });
            await beforeDeadline(server.dispose(), 'failed opening shutdown');
            finished = exporter.getFinishedSpans().map(span => span.name);
        } finally { release.release(); await provider.shutdown(); trace.disable(); }
    });
    it('should end the subscription span even though the session was never listed', () => {
        finished.filter(name => name === 'cratis.arc.query.subscribe').should.have.lengthOf(1);
    });
});
