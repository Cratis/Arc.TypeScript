// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { metrics, SpanKind, SpanStatusCode, trace, type Attributes } from '@opentelemetry/api';

const tracer = trace.getTracer('Cratis.Arc');

/** Observe the lifetime of a subscription without holding an active span across unrelated callbacks. */
export function beginSubscription(queryName: string, correlationId: string): () => void {
    const started = performance.now();
    const span = tracer.startSpan('cratis.arc.query.subscribe', { attributes: {
        queryName, 'cratis.correlation_id': correlationId
    } });
    return () => {
        metrics.getMeter('Cratis.Arc').createHistogram('cratis.arc.subscription.duration', { unit: 's',
            description: 'Lifetime of an Arc observable subscription' })
            .record((performance.now() - started) / 1000, { queryName });
        span.end();
    };
}

/** Start an Arc span and measure the completed operation without recording payloads or caller identities. */
export async function observe<T>(name: string, correlationId: string, attributes: Attributes,
    callback: () => T | Promise<T>, kind: SpanKind = SpanKind.INTERNAL): Promise<T> {
    const started = performance.now();
    return tracer.startActiveSpan(name, { kind, attributes: {
        ...attributes, 'cratis.correlation_id': correlationId
    } }, async span => {
        try {
            const value = await callback();
            return value;
        } catch (error) {
            span.recordException(error instanceof Error ? error : String(error));
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw error;
        } finally {
            metrics.getMeter('Cratis.Arc').createHistogram('cratis.arc.operation.duration', { unit: 's',
                description: 'Duration of an Arc operation' }).record((performance.now() - started) / 1000,
                { operation: name, ...attributes });
            span.end();
        }
    });
}
