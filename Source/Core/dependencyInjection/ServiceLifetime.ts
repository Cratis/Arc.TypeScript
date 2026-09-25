// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Lifetime of a registered dependency. */
export enum ServiceLifetime {
    /** One instance shared across the application. */
    Singleton = 'singleton',
    /** One instance per execution scope. */
    Scoped = 'scoped',
    /** A new instance on each resolution. */
    Transient = 'transient'
}
