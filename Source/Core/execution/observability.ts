// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { context, metrics, SpanKind, SpanStatusCode, trace, type Attributes } from '@opentelemetry/api';
import { packageVersion } from '../Version.js';
import { CardinalityLimiter } from './CardinalityLimiter.js';
import { WellKnownTelemetryNames } from './WellKnownTelemetryNames.js';

const instruments = new WeakMap<object, ReturnType<typeof createInstruments>>();
function createInstruments(meter: ReturnType<typeof metrics.getMeter>) {
    return {
        commandTypes: new CardinalityLimiter(), queryNames: new CardinalityLimiter(), routes: new CardinalityLimiter(),
        subscription: meter.createHistogram(WellKnownTelemetryNames.subscriptionDuration, { unit: 's',
            description: 'Lifetime of an Arc observable subscription' }),
        operation: meter.createHistogram(WellKnownTelemetryNames.operationDuration, { unit: 's',
            description: 'Duration of an Arc operation (deprecated; use command and query duration)' }),
        command: meter.createHistogram(WellKnownTelemetryNames.commandDuration, { unit: 's',
            description: 'Duration of an Arc command execution' }),
        commandOutcomes: meter.createCounter(WellKnownTelemetryNames.commandOutcomes, { unit: '{command}',
            description: 'Number of Arc command executions, by outcome' }),
        query: meter.createHistogram(WellKnownTelemetryNames.queryDuration, { unit: 's',
            description: 'Duration of an Arc query execution' })
    };
}
function measurementInstruments() {
    const meter = metrics.getMeter(WellKnownTelemetryNames.scope, packageVersion);
    let existing = instruments.get(meter);
    if (!existing) {
        existing = createInstruments(meter);
        instruments.set(meter, existing);
    }
    return existing;
}

/** Observe the lifetime of a subscription without holding an active span across unrelated callbacks. */
export function beginSubscription(queryName: string, correlationId: string): { end: () => void; run: <T>(callback: () => T) => T } {
    const started = performance.now();
    const span = trace.getTracer(WellKnownTelemetryNames.scope, packageVersion).startSpan(WellKnownTelemetryNames.querySubscribeSpan, { attributes: {
        query_name: queryName, [WellKnownTelemetryNames.queryName]: queryName, 'cratis.correlation_id': correlationId
    } });
    return {
        run: callback => context.with(trace.setSpan(context.active(), span), callback),
        end: () => {
            const instruments = measurementInstruments();
            const name = instruments.queryNames.limit(queryName);
            instruments.subscription.record((performance.now() - started) / 1000,
                { query_name: name, [WellKnownTelemetryNames.queryName]: name });
            span.end();
        }
    };
}

/** Start an Arc span and measure the completed operation without recording payloads or caller identities. */
export async function observe<T>(name: string, correlationId: string, attributes: Attributes,
    callback: () => T | Promise<T>, kind: SpanKind = SpanKind.INTERNAL,
    failed: (value: T) => boolean = () => false,
    completed: (value?: T) => Attributes = () => ({})): Promise<T> {
    const started = performance.now();
    const entityAttributes: Attributes = {};
    if (attributes.command_type !== undefined) entityAttributes[WellKnownTelemetryNames.commandType] = attributes.command_type;
    if (attributes.query_name !== undefined) entityAttributes[WellKnownTelemetryNames.queryName] = attributes.query_name;
    return trace.getTracer(WellKnownTelemetryNames.scope, packageVersion).startActiveSpan(name, { kind, attributes: {
        ...attributes, ...entityAttributes, 'cratis.correlation_id': correlationId
    } }, async span => {
        let completion: Attributes = {};
        try {
            const value = await callback();
            completion = completed(value);
            if (failed(value)) span.setStatus({ code: SpanStatusCode.ERROR });
            return value;
        } catch (error) {
            completion = completed();
            span.recordException({ name: error instanceof Error ? error.name : 'Error' });
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw error;
        } finally {
            span.setAttributes(completion);
            const duration = (performance.now() - started) / 1000;
            const instruments = measurementInstruments();
            const legacy = { ...attributes };
            const measured = { ...entityAttributes, ...completion };
            if (typeof attributes.command_type === 'string')
                measured[WellKnownTelemetryNames.commandType] = legacy.command_type = instruments.commandTypes.limit(attributes.command_type);
            if (typeof attributes.query_name === 'string')
                measured[WellKnownTelemetryNames.queryName] = legacy.query_name = instruments.queryNames.limit(attributes.query_name);
            if (typeof attributes['http.route'] === 'string') legacy['http.route'] = instruments.routes.limit(attributes['http.route']);
            instruments.operation.record(duration, { operation: name, ...legacy });
            if (name === WellKnownTelemetryNames.commandExecuteSpan) {
                instruments.command.record(duration, measured);
                instruments.commandOutcomes.add(1, measured);
            }
            if (name === WellKnownTelemetryNames.queryPerformSpan) instruments.query.record(duration, measured);
            span.end();
        }
    });
}
