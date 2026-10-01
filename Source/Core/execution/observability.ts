// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { context, metrics, SpanKind, SpanStatusCode, trace, type Attributes } from '@opentelemetry/api';
import packageMetadata from '../package.json' with { type: 'json' };
import { WellKnownTelemetryNames } from './WellKnownTelemetryNames.js';

const instruments = new WeakMap<object, ReturnType<typeof createHistograms>>();
function createHistograms(meter: ReturnType<typeof metrics.getMeter>) {
    return {
        subscription: meter.createHistogram(WellKnownTelemetryNames.subscriptionDuration, { unit: 's',
            description: 'Lifetime of an Arc observable subscription' }),
        operation: meter.createHistogram(WellKnownTelemetryNames.operationDuration, { unit: 's',
            description: 'Duration of an Arc operation (deprecated; use command and query duration)' }),
        command: meter.createHistogram(WellKnownTelemetryNames.commandDuration, { unit: 's',
            description: 'Duration of an Arc command execution' }),
        query: meter.createHistogram(WellKnownTelemetryNames.queryDuration, { unit: 's',
            description: 'Duration of an Arc query execution' })
    };
}
function histograms() {
    const meter = metrics.getMeter(WellKnownTelemetryNames.scope, packageMetadata.version);
    let existing = instruments.get(meter);
    if (!existing) {
        existing = createHistograms(meter);
        instruments.set(meter, existing);
    }
    return existing;
}

/** Observe the lifetime of a subscription without holding an active span across unrelated callbacks. */
export function beginSubscription(queryName: string, correlationId: string): { end: () => void; run: <T>(callback: () => T) => T } {
    const started = performance.now();
    const span = trace.getTracer(WellKnownTelemetryNames.scope, packageMetadata.version).startSpan('cratis.arc.query.subscribe', { attributes: {
        query_name: queryName, 'cratis.arc.query.name': queryName, 'cratis.correlation_id': correlationId
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
    const entityAttributes: Attributes = {};
    if (attributes.command_type !== undefined) entityAttributes['cratis.arc.command.type'] = attributes.command_type;
    if (attributes.query_name !== undefined) entityAttributes['cratis.arc.query.name'] = attributes.query_name;
    return trace.getTracer(WellKnownTelemetryNames.scope, packageMetadata.version).startActiveSpan(name, { kind, attributes: {
        ...attributes, ...entityAttributes, 'cratis.correlation_id': correlationId
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
            const duration = (performance.now() - started) / 1000;
            const instruments = histograms();
            instruments.operation.record(duration, { operation: name, ...attributes });
            if (name === 'cratis.arc.command.execute') instruments.command.record(duration, entityAttributes);
            if (name === 'cratis.arc.query.perform') instruments.query.record(duration, entityAttributes);
            span.end();
        }
    });
}
