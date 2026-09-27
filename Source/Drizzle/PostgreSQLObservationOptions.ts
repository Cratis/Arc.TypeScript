// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { PostgreSQLListenerConnection } from './PostgreSQLListenerConnection.js';
import type { PostgreSQLListenerContext } from './PostgreSQLListenerContext.js';
import { DrizzleObservation } from './DrizzleObservation.js';

/** Experimental cross-process PostgreSQL observation. Applications install triggers through migrations. */
export interface PostgreSQLObservationOptions {
    mode: DrizzleObservation.PostgreSQLNotify;
    listener: (tenant: string, context: PostgreSQLListenerContext) => PostgreSQLListenerConnection | Promise<PostgreSQLListenerConnection>;
}
