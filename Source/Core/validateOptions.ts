// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from './dependencyInjection/ServiceLifetime.js';
import { z } from 'zod';
import type { ArcOptions } from './ArcOptions.js';
import { ServiceRegistry } from './dependencyInjection/ServiceRegistry.js';
import { objectSchema } from './reflection/wireSchema.js';
import { ObservableLimits } from './queries/observable/ObservableLimits.js';
import type { ObservableQueryOptions } from './queries/ObservableQueryOptions.js';
import { validateTenancy } from './tenancy/validateTenancy.js';

function validateOrigins(origins: ObservableQueryOptions['allowedOrigins']): void {
    if (origins !== undefined && !Array.isArray(origins) && typeof origins !== 'function')
        throw new Error('Invalid allowed Origins');
    if (Array.isArray(origins) && origins.some(origin => {
        if (typeof origin !== 'string') return true;
        try {
            const parsed = new URL(origin);
            return parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol);
        } catch { return true; }
    })) throw new Error('Invalid allowed Origin');
}

/** Validate input-independent server settings and normalize an identity provider schema. */
export function validateOptions(options: ArcOptions): {
    options: ArcOptions; identitySchema: Record<string, unknown> | undefined; observableLimits: ObservableLimits
} {
    const detailsSchema = options.identityDetails?.schema ?? (options.identityDetails?.detailsType
        ? objectSchema(options.identityDetails.detailsType) : undefined);
    const normalized = detailsSchema && options.identityDetails ? {
        ...options, identityDetails: { ...options.identityDetails, schema: detailsSchema }
    } : options;
    if (options.correlationId?.httpHeader !== undefined && !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(options.correlationId.httpHeader))
        throw new Error('Invalid correlation header');
    if (options.commandCompensationTimeoutMs !== undefined &&
        (!Number.isSafeInteger(options.commandCompensationTimeoutMs) || options.commandCompensationTimeoutMs < 1 ||
            options.commandCompensationTimeoutMs > 4_294_967_294))
        throw new Error('Compensation timeout must be positive and at most 4294967294 milliseconds');
    validateTenancy(options.tenancy);
    if (options.nativePrincipal && options.authentication?.length)
        throw new Error('Native principal and Arc authentication handlers cannot be combined');
    if (options.identityDetails && (!(detailsSchema instanceof z.ZodType) || typeof options.identityDetails.provide !== 'function'))
        throw new Error('Identity details require a provider schema');
    if ((options.developmentUsers || options.developmentTenants) && !options.development)
        throw new Error('Discovery providers require development mode');
    const identitySchema = detailsSchema ? z.toJSONSchema(detailsSchema) : undefined;
    const observableLimits = new ObservableLimits(options);
    validateOrigins(options.query?.allowedOrigins);
    return { options: normalized, identitySchema, observableLimits };
}

/** Enforce scoped read-side extensions after the service registry has been created. */
export function validateRegistryOptions(options: ArcOptions, services: ServiceRegistry): void {
    for (const token of options.authorizationCommandFilters ?? []) if (options.commandPipelineFilters?.includes(token))
        throw new Error(`Command filter registered in both groups: ${String(token)}`);
    for (const token of [...options.authorizationCommandFilters ?? [], ...options.commandPipelineFilters ?? []]) {
        if (services.registration(token).lifetime === ServiceLifetime.Singleton)
            throw new Error(`Command filter ${services.registration(token).token.name} must not be singleton`);
    }
    for (const token of [...options.queryRenderers ?? [], ...options.readModelInterceptors ?? []]) {
        if (services.registration(token).lifetime === ServiceLifetime.Singleton)
            throw new Error(`Query renderer or read-model interceptor ${services.registration(token).token.name} must not be singleton`);
    }
}

/** Validate transport limits after service registration, before routes are published. */
export function validateTransportOptions(options: ArcOptions): void {
    if (options.hosting?.maxBodyBytes !== undefined &&
        (!Number.isSafeInteger(options.hosting.maxBodyBytes) || options.hosting.maxBodyBytes <= 0))
        throw new Error('Invalid maximum body size');
    if (options.query?.keepAliveIntervalMs !== undefined &&
        (!Number.isSafeInteger(options.query.keepAliveIntervalMs) || options.query.keepAliveIntervalMs < 0 ||
            options.query.keepAliveIntervalMs > 120_000)) throw new Error('Invalid observable keep-alive interval');
    if (options.query?.enableObservableHealth !== undefined && typeof options.query.enableObservableHealth !== 'boolean')
        throw new Error('Invalid observable health option');
}
