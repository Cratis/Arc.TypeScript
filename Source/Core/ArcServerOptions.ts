// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { GeneratedApiOptions } from './GeneratedApiOptions.js';
import type { AuthenticationHandler, CommandDefinition, Principal, QueryDefinition } from './index.js';
import type { AuthorizationPolicyRegistration } from './authorization/AuthorizationPolicy.js';
import type { ServiceRegistry } from './dependencyInjection/ServiceRegistry.js';
import type { ServiceRegistration } from './dependencyInjection/ServiceRegistration.js';
import type { IdentityDetailsProvider } from './identity/IdentityDetailsProvider.js';
import type { TenancyOptions } from './tenancy/TenancyOptions.js';
import type { DevelopmentUser } from './identity/DevelopmentUser.js';
import type { DevelopmentTenant } from './tenancy/DevelopmentTenant.js';
import type { ExecutionContext } from './execution/ExecutionContext.js';
import type { NativeRequestContext } from './http/NativeRequestContext.js';
import type { ObservableQueryDefinition } from './queries/observable/ObservableQueryDefinition.js';
import type { ObservableEmissionGuard } from './queries/observable/ObservableEmissionGuard.js';
import type { ServiceToken } from './dependencyInjection/ServiceToken.js';
import type { ServiceIdentifier } from './dependencyInjection/ServiceIdentifier.js';
import type { CommandResponseValueHandler } from './commands/CommandResponseValueHandler.js';
import type { CommandContextValuesProvider } from './commands/CommandContextValuesProvider.js';
import type { CommandKeyResolver } from './commands/CommandKeyResolver.js';
import type { QueryRenderer } from './queries/QueryRenderer.js';
import type { ReadModelInterceptor } from './queries/ReadModelInterceptor.js';
import type { ReadModelForCommandResolver } from './commands/ReadModelForCommandResolver.js';
import type { CommandResult } from './commands/CommandResult.js';
import type { CommandContext } from './commands/CommandContext.js';
/** Options shared by the low-level Arc server and model-bound application builder. */
export interface ArcServerOptions {
    commands?: readonly CommandDefinition<z.ZodType, unknown>[];
    /** Ordered, scoped server-only response value handlers. */
    commandResponseValueHandlers?: readonly ServiceIdentifier<CommandResponseValueHandler>[];
    /** Ordered, scoped command value providers. */
    commandContextValuesProviders?: readonly ServiceIdentifier<CommandContextValuesProvider>[];
    /** Application key rules run before the default @key/getKey rule. */
    commandKeyResolvers?: readonly ServiceIdentifier<CommandKeyResolver>[];
    /** Ordered read-model sources used by explicit command parameter markers. */
    readModelForCommandResolvers?: readonly ServiceIdentifier<ReadModelForCommandResolver>[];
    /** Isolate ambient integration state for the whole validated command execution. */
    commandExecutionRunner?: (context: CommandContext, execute: () => Promise<CommandResult>) => Promise<CommandResult>;
    /** Shared, cooperative compensation budget (default 30 seconds). */
    commandCompensationTimeoutMs?: number;
    services?: ServiceRegistry | readonly ServiceRegistration<unknown>[];
    queries?: readonly QueryDefinition<z.ZodType, unknown>[];
    /** Ordered scoped renderers; the first matching renderer owns the result. */
    queryRenderers?: readonly ServiceIdentifier<QueryRenderer>[];
    /** Ordered scoped interceptors applied to exact model types on every delivery. */
    readModelInterceptors?: readonly ServiceIdentifier<ReadModelInterceptor>[];
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
    /** Maximum time to join hub subscriptions on shutdown; defaults to 10 seconds. */
    observableShutdownTimeoutMs?: number;
    /** Allowed WS/SSE control Origins. By default only the trusted native authority is allowed. */
    allowedOrigins?: readonly string[] | ((origin: string, request: Request, native?: NativeRequestContext) => boolean | Promise<boolean>);
    /** Advertised hub keep-alive cadence in milliseconds (0 disables); defaults to 30 seconds. */
    observableKeepAliveIntervalMs?: number;
    /** Opt in to caller-scoped query health; disabled by default because connection metadata is sensitive. */
    enableObservableHealth?: boolean;
    /** Resolve emission policies in each subscription's service scope. */
    observableEmissionGuards?: readonly ServiceToken<ObservableEmissionGuard>[];
    /** Convention-based API route configuration. */
    generatedApis?: GeneratedApiOptions;
    /** @deprecated Use generatedApis.routePrefix. */
    prefix?: string;
    /** @deprecated Use generatedApis.segmentsToSkipForRoute. */
    segmentsToSkip?: number;
    /** @deprecated Use generatedApis.includeCommandNameInRoute. */
    includeCommandNameInRoute?: boolean;
    /** @deprecated Use generatedApis.includeQueryNameInRoute. */
    includeQueryNameInRoute?: boolean;
    enableQueryMethod?: boolean;
    maxBodyBytes?: number;
    correlationHeader?: string;
    tenantHeader?: string;
    resolveTenant?: (request: Request, principal: Principal | undefined) => string | undefined | Promise<string | undefined>;
    authentication?: readonly AuthenticationHandler[];
    /** Named authentication handlers, selected explicitly by @authorize({ schemes }). */
    authenticationSchemes?: Readonly<Record<string, AuthenticationHandler>>;
    /** Named policies checked at build time and evaluated in the command/query pipeline. */
    authorizationPolicies?: Readonly<Record<string, AuthorizationPolicyRegistration>>;
    development?: boolean;
    logger?: (error: unknown, correlationId: string) => void;
    identityDetailsSchema?: Record<string, unknown>;
    identityDetails?: IdentityDetailsProvider;
    /** Exclusive with authentication handlers. The adapter must supply a host-verified principal. */
    nativePrincipal?: boolean;
    tenancy?: TenancyOptions;
    /** Development-only anonymous discovery; never enabled by default. */
    developmentUsers?: readonly ((context: ExecutionContext) => readonly DevelopmentUser[] | Promise<readonly DevelopmentUser[]>)[] |
        ((context: ExecutionContext) => readonly DevelopmentUser[] | Promise<readonly DevelopmentUser[]>);
    developmentTenants?: readonly ((context: ExecutionContext) => readonly DevelopmentTenant[] | Promise<readonly DevelopmentTenant[]>)[] |
        ((context: ExecutionContext) => readonly DevelopmentTenant[] | Promise<readonly DevelopmentTenant[]>);
}
