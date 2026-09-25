// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Node hosting configuration; explicitly supplied listener options take precedence. */
export interface HostingOptions {
    /** Standalone HTTP listener URL; defaults to http://127.0.0.1:3000/. */
    applicationUrl?: string;
    /** Maximum JSON request body size in bytes; defaults to 1 MiB. */
    maxBodyBytes?: number;
}
