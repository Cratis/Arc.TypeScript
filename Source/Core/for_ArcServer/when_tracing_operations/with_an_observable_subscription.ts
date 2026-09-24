// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { trace } from '@opentelemetry/api';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { Severity } from '../../validation/Severity.js';
should();

describe('when tracing an observable subscription', () => {
    let names: string[];
    beforeEach(async () => {
        const exporter = new InMemorySpanExporter();
        const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
        trace.setGlobalTracerProvider(provider);
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => CurrentValueSubject.of([1])
        })] });
        try {
            const session = await server.openObservableQuery('Numbers', {}, {
                correlationId: '11111111-1111-4111-8111-111111111111', principal: undefined, tenantId: undefined,
                signal: new AbortController().signal, allowedSeverity: Severity.Warning
            });
            await session.current();
            await session.close();
            names = exporter.getFinishedSpans().map(span => span.name);
        } finally {
            await server.dispose(); await provider.shutdown(); trace.disable();
        }
    });
    it('should end the subscription span after source and emission work', () => {
        names.should.include.members(['cratis.arc.query.subscribe', 'cratis.arc.query.perform', 'cratis.arc.query.emission']);
    });
});
