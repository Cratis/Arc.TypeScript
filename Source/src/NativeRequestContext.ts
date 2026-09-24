// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Principal } from './Principal.js';
/** Server-side adapter metadata, never constructed from HTTP headers or a browser Request. */
export interface NativeRequestContext {
    readonly secure?: boolean;
    /** Remote peer address read from the host socket, never from forwarding headers by default. */
    readonly remoteAddress?: string;
    /** Verified authority from trusted host configuration, NOT the request Host header. */
    readonly authority?: string;
    /** Result of host authentication; only consumed with nativePrincipal enabled. */
    readonly principal?: Principal;
}
