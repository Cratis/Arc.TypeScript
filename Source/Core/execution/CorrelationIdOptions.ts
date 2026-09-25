// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Configure the correlation identifier carried through requests and responses. */
export interface CorrelationIdOptions {
    /** HTTP header carrying the correlation ID; defaults to X-Correlation-ID. */
    httpHeader?: string;
}
