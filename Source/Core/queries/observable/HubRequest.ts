// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Client subscribe payload; arguments are flat strings rather than a structured QUERY body. */
export interface HubRequest {
    readonly queryName: string;
    readonly arguments?: Record<string, string | null>;
    readonly page?: number;
    readonly pageSize?: number;
    readonly sortBy?: string;
    readonly sortDirection?: string;
    readonly transferMode?: string;
}
