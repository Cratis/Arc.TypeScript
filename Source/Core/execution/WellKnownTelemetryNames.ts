// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Public instrumentation names for Arc traces and metrics. */
export const WellKnownTelemetryNames = {
    scope: 'Cratis.Arc',
    commandExecuteSpan: 'cratis.arc.command.execute',
    commandValidateSpan: 'cratis.arc.command.validate',
    commandFilterSpan: 'cratis.arc.command.filter',
    queryPerformSpan: 'cratis.arc.query.perform',
    queryFilterSpan: 'cratis.arc.query.filter',
    queryEmissionSpan: 'cratis.arc.query.emission',
    querySubscribeSpan: 'cratis.arc.query.subscribe',
    httpHandleSpan: 'cratis.arc.http.handle',
    identityResolveSpan: 'cratis.arc.identity.resolve',
    commandType: 'cratis.arc.command.type',
    commandOutcome: 'cratis.arc.command.outcome',
    queryName: 'cratis.arc.query.name',
    queryTransport: 'cratis.arc.query.transport',
    queryOutcome: 'cratis.arc.query.outcome',
    commandOutcomes: 'cratis.arc.command.outcomes',
    commandDuration: 'cratis.arc.command.duration',
    queryDuration: 'cratis.arc.query.duration',
    /** @deprecated Use commandDuration and queryDuration. Emitted in parallel for one minor release. */
    operationDuration: 'cratis.arc.operation.duration',
    subscriptionDuration: 'cratis.arc.subscription.duration'
} as const;
