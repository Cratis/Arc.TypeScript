// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from './ArcServer.js';
import type { NativeRequestContext } from './http/NativeRequestContext.js';
import type { ArcOptions } from './ArcOptions.js';
import { ArcApplicationBuilder } from './ArcApplicationBuilder.js';

/** A Fetch-native Arc application; its host owns the HTTP listener and request lifecycle. */
export class FetchArcApplication {
    /** Build from explicitly registered artifacts without filesystem configuration or discovery. */
    static createBuilder(options: ArcOptions = {}): ArcApplicationBuilder {
        return new ArcApplicationBuilder(options);
    }
    constructor(readonly server: ArcServer) {}
    /** Dispatch a Fetch request; non-Arc paths produce a 404 Response. */
    readonly fetch = async (request: Request, native?: NativeRequestContext): Promise<Response> =>
        await this.server.handle(request, native) ?? new Response(null, { status: 404 });
    /** Dispatch a Fetch request while preserving fall-through for other routes. */
    readonly handle = (request: Request, native?: NativeRequestContext): Promise<Response | null> =>
        this.server.handle(request, native);
    /** Dispose application-owned services and active observable sessions. */
    async dispose(): Promise<void> { await this.server.dispose(); }
}
