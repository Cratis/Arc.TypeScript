// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { stringifyWire } from '../reflection/stringifyWire.js';

/** Response helpers shared by HTTP endpoints while preserving correlation headers. */
export class EndpointResponse {
    constructor(readonly headers: Headers) {}

    send(value: unknown, code: number, extra?: HeadersInit): Response {
        return new Response(stringifyWire(value), { status: code, headers: new Headers({
            ...Object.fromEntries(this.headers), 'content-type': 'application/json; charset=utf-8',
            ...Object.fromEntries(new Headers(extra))
        }) });
    }

    methodNotAllowed(allowed: string): Response {
        return new Response(null, { status: 405, headers: new Headers({ ...Object.fromEntries(this.headers), allow: allowed }) });
    }
}
