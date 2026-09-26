// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Experimental SQL observation modes; PostgreSQL requires an object-form listener configuration. */
export enum DrizzleObservation {
    InProcess = 'in-process',
    PostgreSQLNotify = 'postgresql-notify'
}
