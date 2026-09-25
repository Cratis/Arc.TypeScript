// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { ArcOptions } from '../ArcOptions.js';
import { ArcServer } from '../ArcServer.js';
import { FetchArcApplication } from '../FetchArcApplication.js';
import type { Artifact } from '../reflection/Artifact.js';
import type { ArtifactMetadata } from '../reflection/ArtifactMetadata.js';
import type { ClassType } from '../reflection/ClassType.js';
import { ownMetadata } from '../reflection/ownMetadata.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import type { ArcApplicationServices } from '../dependencyInjection/ArcApplicationServices.js';
import type { CommandDefinition } from '../commands/CommandDefinition.js';
import type { QueryDefinition } from '../queries/QueryDefinition.js';
import type { ObservableQueryDefinition } from '../queries/observable/ObservableQueryDefinition.js';
import { ModelGraphValidator } from '../validation/ModelGraphValidator.js';
import type { CommandResponseValueHandler } from '../commands/CommandResponseValueHandler.js';
import type { CommandContextValuesProvider } from '../commands/CommandContextValuesProvider.js';
import type { CommandKeyResolver } from '../commands/CommandKeyResolver.js';
import type { ReadModelForCommandResolver } from '../commands/ReadModelForCommandResolver.js';
import type { CommandExecutionScope } from '../commands/CommandExecutionScope.js';
import type { CommandContext } from '../commands/CommandContext.js';
import type { CommandResult } from '../commands/CommandResult.js';
import type { QueryRenderer } from '../queries/QueryRenderer.js';
import type { ReadModelInterceptor } from '../queries/ReadModelInterceptor.js';
import type { AuthorizationPolicyRegistration } from '../authorization/AuthorizationPolicy.js';
import type { IdentityDetailsProvider } from '../identity/IdentityDetailsProvider.js';
import { compileArtifacts, registerValidators } from '../registration/compileArtifacts.js';
import { preflight } from './preflight.js';

/** Inputs owned by the builder and consumed when it compiles a server. */
export interface BuildRegistrations {
    options: ArcOptions;
    services: ArcApplicationServices;
    artifacts: readonly Artifact[];
    responseHandlers: ServiceIdentifier<CommandResponseValueHandler>[];
    valueProviders: ServiceIdentifier<CommandContextValuesProvider>[];
    keyResolvers: ServiceIdentifier<CommandKeyResolver>[];
    queryRenderers: ServiceIdentifier<QueryRenderer>[];
    readModelInterceptors: ServiceIdentifier<ReadModelInterceptor>[];
    readModelResolvers: ServiceIdentifier<ReadModelForCommandResolver>[];
    commandRunners: readonly ((context: CommandContext, execute: () => Promise<CommandResult>) => Promise<CommandResult>)[];
    commandScopes: readonly (() => CommandExecutionScope)[];
    builtObservers: readonly ((server: ArcServer) => void)[];
    policies: ReadonlyMap<string, AuthorizationPolicyRegistration>;
    identityProviders: readonly ClassType[];
    generatedMetadata?: ReadonlyMap<ClassType, ArtifactMetadata>;
}

function identityProvider(registrations: BuildRegistrations): IdentityDetailsProvider | undefined {
    const { options, identityProviders } = registrations;
    if (options.identityDetails && identityProviders.length)
        throw new Error('Explicit and discovered identity details providers cannot be combined');
    if (!options.identityDetails && identityProviders.length > 1)
        throw new Error(`Multiple identity details providers found: ${identityProviders.map(type => type.name).join(', ')}`);
    const providerType = identityProviders[0];
    const instance = !options.identityDetails && providerType ? Reflect.construct(providerType, []) as IdentityDetailsProvider : undefined;
    return instance && providerType ? {
        schema: instance.schema, detailsType: instance.detailsType,
        provide: (principal, context) => (Reflect.construct(providerType, []) as IdentityDetailsProvider).provide(principal, context)
    } : undefined;
}

function serverOptions(registrations: BuildRegistrations, commands: CommandDefinition<z.ZodType, unknown>[],
    queries: QueryDefinition<z.ZodType, unknown>[], observableQueries: ObservableQueryDefinition<z.ZodType, unknown>[]): ArcOptions {
    const { options } = registrations;
    const discovered = identityProvider(registrations);
    const runners = [...options.commandExecutionRunner ? [options.commandExecutionRunner] : [], ...registrations.commandRunners];
    const commandExecutionRunner = runners.length ? (context: CommandContext, execute: () => Promise<CommandResult>) =>
        runners.reduceRight<() => Promise<CommandResult>>((next, runner) => () => runner(context, next), execute)() : undefined;
    return { ...options, commands, queries, observableQueries, commandExecutionRunner,
        commandExecutionScopes: [...options.commandExecutionScopes ?? [], ...registrations.commandScopes],
        identityDetails: options.identityDetails ?? discovered,
        authorizationPolicies: { ...options.authorizationPolicies, ...Object.fromEntries(registrations.policies) },
        commandResponseValueHandlers: [...options.commandResponseValueHandlers ?? [], ...registrations.responseHandlers],
        commandContextValuesProviders: [...options.commandContextValuesProviders ?? [], ...registrations.valueProviders],
        commandKeyResolvers: [...options.commandKeyResolvers ?? [], ...registrations.keyResolvers],
        queryRenderers: [...options.queryRenderers ?? [], ...registrations.queryRenderers],
        readModelInterceptors: [...options.readModelInterceptors ?? [], ...registrations.readModelInterceptors],
        readModelForCommandResolvers: [...options.readModelForCommandResolvers ?? [], ...registrations.readModelResolvers],
        services: options.services && !Array.isArray(options.services) ? options.services :
            [...Array.isArray(options.services) ? options.services : [], ...registrations.services.registrations] };
}

/** Compile registrations, verify their dependencies and notify built observers. */
export async function buildRegistered(registrations: BuildRegistrations): Promise<FetchArcApplication> {
    const { options, services, artifacts } = registrations;
    if (options.services && !Array.isArray(options.services) &&
        (services.registrations.length || artifacts.some(({ type }) => {
            const metadata = ownMetadata(type);
            return metadata.lifetime || metadata.validatorTarget || metadata.responseValueHandler ||
                metadata.queryRenderer || metadata.readModelInterceptor;
        }))) throw new Error('Decorated lifetimes and builder registrations require builder-owned services');
    const dependencies: ServiceIdentifier<unknown>[] = [];
    const validatorTypes = registerValidators(artifacts, options, services, dependencies);
    const graph = new ModelGraphValidator(validatorTypes, options.logger);
    const commands: CommandDefinition<z.ZodType, unknown>[] = [...options.commands ?? []];
    const queries: QueryDefinition<z.ZodType, unknown>[] = [...options.queries ?? []];
    const observableQueries: ObservableQueryDefinition<z.ZodType, unknown>[] = [...options.observableQueries ?? []];
    compileArtifacts(artifacts, graph, registrations, dependencies, commands, queries, observableQueries);
    dependencies.push(...registrations.responseHandlers, ...registrations.valueProviders, ...registrations.keyResolvers,
        ...registrations.readModelResolvers, ...options.readModelForCommandResolvers ?? [],
        ...options.commandResponseValueHandlers ?? [], ...options.commandContextValuesProviders ?? [],
        ...options.commandKeyResolvers ?? [], ...registrations.queryRenderers, ...registrations.readModelInterceptors,
        ...options.queryRenderers ?? [], ...options.readModelInterceptors ?? []);
    if (options.services && !Array.isArray(options.services) && services.registrations.length)
        throw new Error('A supplied ServiceRegistry cannot be combined with builder service registrations');
    const server = new ArcServer(serverOptions(registrations, commands, queries, observableQueries), registrations.generatedMetadata);
    try {
        await preflight(server, dependencies, validatorTypes, registrations.policies, artifacts, options, registrations.readModelResolvers);
        for (const observer of registrations.builtObservers) observer(server);
    } catch (error) { await server.dispose(); throw error; }
    return new FetchArcApplication(server);
}
