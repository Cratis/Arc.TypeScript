// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { AuthenticationHandler, CommandDefinition, Principal, QueryDefinition } from './contracts.js';
import type { ServiceRegistry } from './ServiceRegistry.js';
import type { ServiceRegistration } from './ServiceRegistration.js';
import type { IdentityDetailsProvider } from './IdentityDetailsProvider.js';
import type { TenancyOptions } from './TenancyOptions.js';
import type { DevelopmentUser } from './DevelopmentUser.js';
import type { DevelopmentTenant } from './DevelopmentTenant.js';
import type { ExecutionContext } from './ExecutionContext.js';
export interface ArcServerOptions {
    commands?: readonly CommandDefinition<z.ZodType, unknown>[];
    services?: ServiceRegistry | readonly ServiceRegistration<unknown>[];
    queries?: readonly QueryDefinition<z.ZodType, unknown>[];
    prefix?: string;
    segmentsToSkip?: number;
    enableQueryMethod?: boolean;
    maxBodyBytes?: number;
    correlationHeader?: string;
    tenantHeader?: string;
    resolveTenant?: (request: Request, principal: Principal | undefined) => string | undefined | Promise<string | undefined>;
    authentication?: readonly AuthenticationHandler[];
    development?: boolean;
    logger?: (error: unknown, correlationId: string) => void;
    identityDetailsSchema?: Record<string, unknown>;
    identityDetails?: IdentityDetailsProvider;
    /** Exclusive with authentication handlers. The adapter must supply a host-verified principal. */
    nativePrincipal?: boolean;
    tenancy?: TenancyOptions;
    /** Development-only anonymous discovery; never enabled by default. */
    developmentUsers?: (context: ExecutionContext) => readonly DevelopmentUser[] | Promise<readonly DevelopmentUser[]>;
    developmentTenants?: (context: ExecutionContext) => readonly DevelopmentTenant[] | Promise<readonly DevelopmentTenant[]>;
}
