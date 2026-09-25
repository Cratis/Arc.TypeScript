// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { GeneratedApiOptions } from './GeneratedApiOptions.js';
import type { AuthenticationHandler } from './authentication/AuthenticationHandler.js';
import type { AuthorizationPolicyRegistration } from './authorization/AuthorizationPolicy.js';
import type { CommandDefinition } from './commands/CommandDefinition.js';
import type { CommandContext } from './commands/CommandContext.js';
import type { AuthorizationCommandFilter } from './commands/AuthorizationCommandFilter.js';
import type { CommandPipelineFilter } from './commands/CommandPipelineFilter.js';
import type { CommandContextValuesProvider } from './commands/CommandContextValuesProvider.js';
import type { CommandExecutionScope } from './commands/CommandExecutionScope.js';
import type { CommandKeyResolver } from './commands/CommandKeyResolver.js';
import type { CommandResponseValueHandler } from './commands/CommandResponseValueHandler.js';
import type { CommandResult } from './commands/CommandResult.js';
import type { ReadModelForCommandResolver } from './commands/ReadModelForCommandResolver.js';
import type { ServiceIdentifier } from './dependencyInjection/ServiceIdentifier.js';
import type { ServiceRegistration } from './dependencyInjection/ServiceRegistration.js';
import type { ServiceRegistry } from './dependencyInjection/ServiceRegistry.js';
import type { CorrelationIdOptions } from './execution/CorrelationIdOptions.js';
import type { ExecutionContext } from './execution/ExecutionContext.js';
import type { HostingOptions } from './http/HostingOptions.js';
import type { DevelopmentUser } from './identity/DevelopmentUser.js';
import type { IdentityDetailsProvider } from './identity/IdentityDetailsProvider.js';
import type { ObservableQueryOptions } from './queries/ObservableQueryOptions.js';
import type { QueryDefinition } from './queries/QueryDefinition.js';
import type { QueryRenderer } from './queries/QueryRenderer.js';
import type { ReadModelInterceptor } from './queries/ReadModelInterceptor.js';
import type { ObservableQueryDefinition } from './queries/observable/ObservableQueryDefinition.js';
import type { DevelopmentTenant } from './tenancy/DevelopmentTenant.js';
import type { TenancyOptions } from './tenancy/TenancyOptions.js';

/** Options shared by the low-level Arc server and model-bound application builder. */
export interface ArcOptions {
    /** Correlation ID ingress and response header. */
    correlationId?: CorrelationIdOptions;
    /** Ordered tenant sources and trusted request resolver. */
    tenancy?: TenancyOptions;
    /** Convention-based command and query endpoints. */
    generatedApis?: GeneratedApiOptions;
    /** Observable query transport, admission, and emission settings. */
    query?: ObservableQueryOptions;
    /** Node hosting settings; standalone listener arguments override the configured URL. */
    hosting?: HostingOptions;
    /** Expose exception messages and stacks to HTTP callers; defaults to true only in Development environments. */
    exposeExceptionDetails?: boolean;
    /** Enable development-only anonymous user and tenant discovery, independently of exception exposure. */
    development?: boolean;
    /** Low-level command definitions. */
    commands?: readonly CommandDefinition<z.ZodType, unknown>[];
    /** Ordered authorization filters; always run before ordinary command filters and validator dependencies. */
    authorizationCommandFilters?: readonly ServiceIdentifier<AuthorizationCommandFilter>[];
    /** Ordered ordinary result-fragment filters, distinct from per-definition CommandFilter<T> callbacks. */
    commandPipelineFilters?: readonly ServiceIdentifier<CommandPipelineFilter>[];
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
    /** Scopes shared by every command, including commands compiled from decorated classes. */
    commandExecutionScopes?: readonly (() => CommandExecutionScope)[];
    /** Shared, cooperative compensation budget in milliseconds; defaults to 30 seconds. */
    commandCompensationTimeoutMs?: number;
    /** Registrations or an externally owned service registry. */
    services?: ServiceRegistry | readonly ServiceRegistration<unknown>[];
    /** Low-level snapshot query definitions. */
    queries?: readonly QueryDefinition<z.ZodType, unknown>[];
    /** Ordered scoped renderers; the first matching renderer owns the result. */
    queryRenderers?: readonly ServiceIdentifier<QueryRenderer>[];
    /** Ordered scoped interceptors applied to exact model types on every delivery. */
    readModelInterceptors?: readonly ServiceIdentifier<ReadModelInterceptor>[];
    /** Observable query definitions sharing the query pipeline and routes. */
    observableQueries?: readonly ObservableQueryDefinition<z.ZodType, unknown>[];
    /** Ordered Arc authentication handlers. */
    authentication?: readonly AuthenticationHandler[];
    /** Named authentication handlers, selected explicitly by @authorize({ schemes }). */
    authenticationSchemes?: Readonly<Record<string, AuthenticationHandler>>;
    /** Named policies checked at build time and evaluated in the command/query pipeline. */
    authorizationPolicies?: Readonly<Record<string, AuthorizationPolicyRegistration>>;
    /** Server-side error logger; never writes exception detail to a redacted response. */
    logger?: (error: unknown, correlationId: string) => void;
    /** Identity details provider for the /.cratis/me endpoint. */
    identityDetails?: IdentityDetailsProvider;
    /** Exclusive with authentication handlers; the adapter must supply a host-verified principal. */
    nativePrincipal?: boolean;
    /** Development-only anonymous user discovery; never enabled by default. */
    developmentUsers?: readonly ((context: ExecutionContext) => readonly DevelopmentUser[] | Promise<readonly DevelopmentUser[]>)[] |
        ((context: ExecutionContext) => readonly DevelopmentUser[] | Promise<readonly DevelopmentUser[]>);
    /** Development-only anonymous tenant discovery; never enabled by default. */
    developmentTenants?: readonly ((context: ExecutionContext) => readonly DevelopmentTenant[] | Promise<readonly DevelopmentTenant[]>)[] |
        ((context: ExecutionContext) => readonly DevelopmentTenant[] | Promise<readonly DevelopmentTenant[]>);
}
