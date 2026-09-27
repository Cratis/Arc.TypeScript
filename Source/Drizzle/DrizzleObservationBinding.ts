// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { DrizzleChangeNotifications } from './DrizzleChangeNotifications.js';
import type { PostgreSQLObservationManager } from './PostgreSQLObservationManager.js';

/** Internal scope-owned observation wiring. */
export interface DrizzleObservationBinding {
    notifications: DrizzleChangeNotifications;
    tenant: string;
    signal?: AbortSignal;
    postgresql?: PostgreSQLObservationManager;
}
