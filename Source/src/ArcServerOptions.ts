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
import type { NativeRequestContext } from './NativeRequestContext.js';
import type { ObservableQueryDefinition } from './queries/observable/ObservableQueryDefinition.js';
import type { ObservableEmissionGuard } from './queries/observable/ObservableEmissionGuard.js';
import type { ServiceToken } from './ServiceToken.js';
export interface ArcServerOptions {
    commands?: readonly CommandDefinition<z.ZodType, unknown>[];
    services?: ServiceRegistry | readonly ServiceRegistration<unknown>[];
    queries?: readonly QueryDefinition<z.ZodType, unknown>[];
    /** Observable queries share query routes and the full query pipeline. */
    observableQueries?: readonly ObservableQueryDefinition<z.ZodType, unknown>[];
    /** Maximum simultaneous subscriptions; defaults to 4096. */
    maxObservableSubscriptions?: number;
    /** Per authenticated principal or anonymous connection/address; defaults to the global 4096 limit. */
    maxObservableSubscriptionsPerCaller?: number;
    /** Maximum physical hub connections across the server; defaults to 512. */
    maxObservableHubConnections?: number;
    /** Maximum hub connections for one principal or anonymous address; defaults to the global 512 limit. */
    maxObservableHubConnectionsPerCaller?: number;
    /** Maximum subscriptions on one hub connection; defaults to 256. */
    maxObservableHubSubscriptionsPerConnection?: number;
    /** Maximum queued inbound or outbound frames; defaults to 256 each. */
    maxObservableInboundFrames?: number;
    maxObservableOutboundFrames?: number;
    maxObservablePendingEmissions?: number;
    /** Maximum inbound WS frame and SSE control body (default 64 KiB), and outbound frame (default 1 MiB). */
    maxObservableInboundFrameBytes?: number;
    maxObservableOutboundFrameBytes?: number;
    /** Maximum retained unsubscribe tombstones per hub connection; defaults to 1024. */
    maxObservableTombstones?: number;
    /** Maximum duration for an upgrade before its handshake finishes; defaults to 10 seconds. */
    observableHandshakeTimeoutMs?: number;
    /** Allowed WS/SSE control Origins. By default only the trusted native authority is allowed. */
    allowedOrigins?: readonly string[] | ((origin: string, request: Request, native?: NativeRequestContext) => boolean | Promise<boolean>);
    /** Advertised hub keep-alive cadence in milliseconds (0 disables); defaults to 30 seconds. */
    observableKeepAliveIntervalMs?: number;
    /** Opt in to caller-scoped query health; disabled by default because connection metadata is sensitive. */
    enableObservableHealth?: boolean;
    /** Resolve emission policies in each subscription's service scope. */
    observableEmissionGuards?: readonly ServiceToken<ObservableEmissionGuard>[];
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
