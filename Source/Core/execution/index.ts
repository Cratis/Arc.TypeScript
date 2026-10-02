// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
export { WellKnownTelemetryNames } from './WellKnownTelemetryNames.js';
export type { ExecutionContext } from './ExecutionContext.js';
export type { RunInScopeOptions } from './RunInScopeOptions.js';
/** Normalize an inbound correlation ID with Arc's rules: a lowercase non-nil UUID, otherwise a new one. */
export { correlation as normalizeCorrelationId } from './correlation.js';
