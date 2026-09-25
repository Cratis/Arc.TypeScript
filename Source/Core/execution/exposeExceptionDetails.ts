// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcOptions } from '../ArcOptions.js';

/** Match Arc's development-environment default without requiring process in Fetch runtimes. */
export function exposeExceptionDetails(options: ArcOptions): boolean {
    if (options.exposeExceptionDetails !== undefined) return options.exposeExceptionDetails;
    const environment = typeof process === 'undefined' ? undefined :
        process.env.DOTNET_ENVIRONMENT ?? process.env.ASPNETCORE_ENVIRONMENT ?? process.env.NODE_ENV;
    return environment?.toLowerCase() === 'development';
}
