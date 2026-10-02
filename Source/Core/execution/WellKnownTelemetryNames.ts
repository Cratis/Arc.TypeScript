// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Public instrumentation names for Arc traces and metrics. */
export const WellKnownTelemetryNames = {
    scope: 'Cratis.Arc',
    commandDuration: 'cratis.arc.command.duration',
    queryDuration: 'cratis.arc.query.duration',
    /** @deprecated Use commandDuration and queryDuration. Emitted in parallel for one minor release. */
    operationDuration: 'cratis.arc.operation.duration',
    subscriptionDuration: 'cratis.arc.subscription.duration'
} as const;
