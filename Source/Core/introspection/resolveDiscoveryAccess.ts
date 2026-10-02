// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcOptions } from '../ArcOptions.js';
import type { DiscoveryAccess } from './DiscoveryAccess.js';

/** Resolve and validate exposure once per server, never once per endpoint or request. */
export function resolveDiscoveryAccess(options: ArcOptions): DiscoveryAccess {
    const configuration = options.introspection;
    if (configuration?.requireAuthentication !== undefined && typeof configuration.requireAuthentication !== 'boolean')
        throw new Error('Cratis:Arc:Introspection:RequireAuthentication must be a boolean.');
    if (configuration?.roles !== undefined && (typeof configuration.roles !== 'string' ||
        configuration.requireAuthentication === false || configuration.roles.split(',').some(role => !role.trim())))
        throw new Error('Cratis:Arc:Introspection:Roles cannot be combined with RequireAuthentication=false and must be a comma-separated list of nonempty roles.');
    const roles = Object.freeze(configuration?.roles?.split(',').map(role => role.trim()) ?? []);
    const environment = options.environmentName ?? (typeof process === 'undefined' ? undefined :
        process.env.DOTNET_ENVIRONMENT ?? process.env.ASPNETCORE_ENVIRONMENT ?? process.env.NODE_ENV);
    const development = environment?.toLowerCase() === 'development';
    const requireAuthentication = roles.length > 0 || (configuration?.requireAuthentication ?? !development);
    const canAuthenticate = options.nativePrincipal === true || (options.authentication?.length ?? 0) > 0;
    const mapped = !requireAuthentication || canAuthenticate;
    if (!mapped && (configuration?.requireAuthentication === true || roles.length > 0))
        throw new Error('Cratis:Arc:Introspection requires authentication, but no Arc authentication handlers or native principal are configured.');
    const warning = !mapped
        ? 'Arc discovery endpoints are not mapped because authentication is not configured. Configure authentication or explicitly set Cratis:Arc:Introspection:RequireAuthentication=false to allow anonymous discovery.'
        : !requireAuthentication && !development
            ? 'Arc discovery endpoints are exposed anonymously outside Development because Cratis:Arc:Introspection:RequireAuthentication=false.' : undefined;
    if (warning) {
        // A failed application logger must not lose the warning or cause an unhandled rejection.
        if (options.logger) {
            try { void Promise.resolve(options.logger(new Error(warning), '')).catch(() => console.warn(warning)); }
            catch { console.warn(warning); }
        } else console.warn(warning);
    }
    return Object.freeze({ mapped, requireAuthentication, roles });
}
