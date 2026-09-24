// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { context, metrics, SpanKind, SpanStatusCode, trace, type Attributes } from '@opentelemetry/api';

const instruments = new WeakMap<object, { subscription: ReturnType<ReturnType<typeof metrics.getMeter>['createHistogram']>;
    operation: ReturnType<ReturnType<typeof metrics.getMeter>['createHistogram']> }>();
function histograms(): { subscription: ReturnType<ReturnType<typeof metrics.getMeter>['createHistogram']>;
    operation: ReturnType<ReturnType<typeof metrics.getMeter>['createHistogram']> } {
    const meter = metrics.getMeter('Cratis.Arc');
    let existing = instruments.get(meter);
    if (!existing) {
        existing = {
            subscription: meter.createHistogram('cratis.arc.subscription.duration', { unit: 's',
                description: 'Lifetime of an Arc observable subscription' }),
            operation: meter.createHistogram('cratis.arc.operation.duration', { unit: 's',
                description: 'Duration of an Arc operation' })
        };
        instruments.set(meter, existing);
    }
    return existing;
}

/** Observe the lifetime of a subscription without holding an active span across unrelated callbacks. */
export function beginSubscription(queryName: string, correlationId: string): { end: () => void; run: <T>(callback: () => T) => T } {
    const started = performance.now();
    const span = trace.getTracer('Cratis.Arc').startSpan('cratis.arc.query.subscribe', { attributes: {
        query_name: queryName, 'cratis.correlation_id': correlationId
    } });
    return {
        run: callback => context.with(trace.setSpan(context.active(), span), callback),
        end: () => {
            histograms().subscription.record((performance.now() - started) / 1000, { query_name: queryName });
            span.end();
        }
    };
}

/** Start an Arc span and measure the completed operation without recording payloads or caller identities. */
export async function observe<T>(name: string, correlationId: string, attributes: Attributes,
    callback: () => T | Promise<T>, kind: SpanKind = SpanKind.INTERNAL,
    failed: (value: T) => boolean = () => false): Promise<T> {
    const started = performance.now();
    return trace.getTracer('Cratis.Arc').startActiveSpan(name, { kind, attributes: {
        ...attributes, 'cratis.correlation_id': correlationId
    } }, async span => {
        try {
            const value = await callback();
            if (failed(value)) span.setStatus({ code: SpanStatusCode.ERROR });
            return value;
        } catch (error) {
            span.recordException({ name: error instanceof Error ? error.name : 'Error' });
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw error;
        } finally {
            histograms().operation.record((performance.now() - started) / 1000, { operation: name, ...attributes });
            span.end();
        }
    });
}
