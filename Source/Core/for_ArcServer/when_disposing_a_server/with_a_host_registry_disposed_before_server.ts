// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { trace } from '@opentelemetry/api';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceRegistry } from '../../dependencyInjection/ServiceRegistry.js';
import { beforeDeadline } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when a host disposes its registry before the server with participants', () => {
    let finished: string[];
    beforeEach(async () => {
        const exporter = new InMemorySpanExporter();
        const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
        trace.setGlobalTracerProvider(provider);
        const registry = new ServiceRegistry();
        const server = new ArcServer({ services: registry, observableQueries: [defineObservableQuery({
            name: 'Live', schema: z.object({}), observe: () => CurrentValueSubject.of(1)
        })] });
        try {
            await server.openObservableQuery('Live', {}, observableExecution());
            registry.addShutdownParticipant({ stop: () => {}, drain: async () => {} });
            await beforeDeadline(registry.dispose(), 'host registry shutdown');
            finished = exporter.getFinishedSpans().map(span => span.name);
        } finally { await server.dispose(); await provider.shutdown(); trace.disable(); }
    });
    it('should end the subscription span even without a registered server cleanup', () => {
        finished.filter(name => name === 'cratis.arc.query.subscribe').should.have.lengthOf(1);
    });
});
