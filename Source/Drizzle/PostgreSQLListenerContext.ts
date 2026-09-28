// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Experimental listener-attempt lifetime, independent of the requesting scope. */
export interface PostgreSQLListenerContext { readonly signal: AbortSignal; }
