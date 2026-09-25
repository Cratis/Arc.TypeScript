// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../dependencyInjection/ServiceLifetime.js';
import type { z } from 'zod';
import type { ArcOptions } from '../ArcOptions.js';
import type { Artifact } from '../reflection/Artifact.js';
import type { ClassType } from '../reflection/ClassType.js';
import { ownMetadata } from '../reflection/ownMetadata.js';
import { validateMetadata } from '../reflection/validateMetadata.js';
import { compileCommand } from '../commands/modelBound/compileCommand.js';
import { compileQueries } from '../queries/modelBound/compileQueries.js';
import type { CommandDefinition } from '../commands/CommandDefinition.js';
import type { QueryDefinition } from '../queries/QueryDefinition.js';
import type { ObservableQueryDefinition } from '../queries/observable/ObservableQueryDefinition.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import type { ArcApplicationServices } from '../dependencyInjection/ArcApplicationServices.js';
import { BaseValidator } from '../validation/BaseValidator.js';
import { ModelGraphValidator } from '../validation/ModelGraphValidator.js';
import type { CommandResponseValueHandler } from '../commands/CommandResponseValueHandler.js';
import type { AuthorizationCommandFilter } from '../commands/AuthorizationCommandFilter.js';
import type { CommandPipelineFilter } from '../commands/CommandPipelineFilter.js';
import type { QueryRenderer } from '../queries/QueryRenderer.js';
import type { AuthorizationQueryFilter } from '../queries/AuthorizationQueryFilter.js';
import type { QueryPipelineFilter } from '../queries/QueryPipelineFilter.js';
import type { ReadModelInterceptor } from '../queries/ReadModelInterceptor.js';

/** Mutable artifact registration lists shared with the application builder. */
export interface ArtifactRegistrations {
    services: ArcApplicationServices;
    responseHandlers: ServiceIdentifier<CommandResponseValueHandler>[];
    authorizationCommandFilters: ServiceIdentifier<AuthorizationCommandFilter>[];
    commandPipelineFilters: ServiceIdentifier<CommandPipelineFilter>[];
    authorizationQueryFilters: ServiceIdentifier<AuthorizationQueryFilter>[];
    queryPipelineFilters: ServiceIdentifier<QueryPipelineFilter>[];
    queryRenderers: ServiceIdentifier<QueryRenderer>[];
    readModelInterceptors: ServiceIdentifier<ReadModelInterceptor>[];
}

/** Register validator services and return the model-to-validator map for preflight. */
export function registerValidators(artifacts: readonly Artifact[], options: ArcOptions, services: ArcApplicationServices,
    dependencies: ServiceIdentifier<unknown>[]): Map<ClassType, ClassType<BaseValidator<unknown>>> {
    const validatorTypes = new Map<ClassType, ClassType<BaseValidator<unknown>>>();
    for (const { type } of artifacts) {
        validateMetadata(type);
        const target = ownMetadata(type).validatorTarget;
        if (!target) continue;
        if (validatorTypes.has(target)) throw new Error(`Duplicate validator target: ${target.name}`);
        validatorTypes.set(target, type as ClassType<BaseValidator<unknown>>);
        const lifetime = ownMetadata(type).lifetime;
        if (lifetime === ServiceLifetime.Singleton) throw new Error(`Validator ${type.name} must not be singleton`);
        const existing = [...Array.isArray(options.services) ? options.services : [], ...services.registrations]
            .find(registration => registration.token === type);
        if (existing?.lifetime === ServiceLifetime.Singleton) throw new Error(`Validator ${type.name} must not be singleton`);
        if (!existing) services[lifetime === ServiceLifetime.Scoped ? 'addScoped' : 'addTransient'](type);
        dependencies.push(type);
    }
    return validatorTypes;
}

function registerQueryExtension(type: ClassType, metadata: ReturnType<typeof ownMetadata>, registrations: ArtifactRegistrations): void {
    if (!metadata.queryRenderer && !metadata.readModelInterceptor) return;
    if (metadata.command || metadata.readModel || metadata.validatorTarget || metadata.responseValueHandler ||
        metadata.queryRenderer && metadata.readModelInterceptor || metadata.lifetime === ServiceLifetime.Singleton)
        throw new Error(`Conflicting Arc query extension artifact: ${type.name}`);
    if (metadata.queryRenderer) {
        if (typeof type.prototype.canRender !== 'function' || typeof type.prototype.render !== 'function')
            throw new Error(`Query renderer ${type.name} requires canRender() and render()`);
        registrations.queryRenderers.push(type as ServiceIdentifier<QueryRenderer>);
    } else {
        if (typeof type.prototype.intercept !== 'function')
            throw new Error(`Read-model interceptor ${type.name} requires intercept()`);
        registrations.readModelInterceptors.push(type as ServiceIdentifier<ReadModelInterceptor>);
    }
    if (!metadata.lifetime) registrations.services.addScoped(type);
}

function registerResponseHandler(type: ClassType, metadata: ReturnType<typeof ownMetadata>, registrations: ArtifactRegistrations): void {
    if (!metadata.responseValueHandler) return;
    if (metadata.command || metadata.readModel || metadata.validatorTarget)
        throw new Error(`Conflicting Arc response handler artifact: ${type.name}`);
    if (typeof type.prototype.canHandle !== 'function' || typeof type.prototype.handle !== 'function')
        throw new Error(`Response handler ${type.name} requires canHandle() and handle()`);
    registrations.responseHandlers.push(type as ServiceIdentifier<CommandResponseValueHandler>);
    if (!metadata.lifetime) registrations.services.addScoped(type);
}

function registerCommandFilter(type: ClassType, metadata: ReturnType<typeof ownMetadata>, registrations: ArtifactRegistrations): void {
    if (!metadata.authorizationCommandFilter && !metadata.commandPipelineFilter) return;
    if (metadata.command || metadata.readModel || metadata.validatorTarget || metadata.responseValueHandler ||
        metadata.queryRenderer || metadata.readModelInterceptor || metadata.authorizationQueryFilter || metadata.queryPipelineFilter ||
        metadata.authorizationCommandFilter && metadata.commandPipelineFilter || metadata.lifetime === ServiceLifetime.Singleton)
        throw new Error(`Conflicting Arc command filter artifact: ${type.name}`);
    if (typeof type.prototype.onExecution !== 'function')
        throw new Error(`Command filter ${type.name} requires onExecution()`);
    if (metadata.authorizationCommandFilter)
        registrations.authorizationCommandFilters.push(type as ServiceIdentifier<AuthorizationCommandFilter>);
    else registrations.commandPipelineFilters.push(type as ServiceIdentifier<CommandPipelineFilter>);
    if (!metadata.lifetime) registrations.services.addScoped(type);
}

function registerQueryFilter(type: ClassType, metadata: ReturnType<typeof ownMetadata>, registrations: ArtifactRegistrations): void {
    if (!metadata.authorizationQueryFilter && !metadata.queryPipelineFilter) return;
    if (metadata.command || metadata.readModel || metadata.validatorTarget || metadata.responseValueHandler ||
        metadata.queryRenderer || metadata.readModelInterceptor || metadata.authorizationCommandFilter || metadata.commandPipelineFilter ||
        metadata.authorizationQueryFilter && metadata.queryPipelineFilter || metadata.lifetime === ServiceLifetime.Singleton)
        throw new Error(`Conflicting Arc query filter artifact: ${type.name}`);
    if (typeof type.prototype.onPerform !== 'function') throw new Error(`Query filter ${type.name} requires onPerform()`);
    if (metadata.authorizationQueryFilter)
        registrations.authorizationQueryFilters.push(type as ServiceIdentifier<AuthorizationQueryFilter>);
    else registrations.queryPipelineFilters.push(type as ServiceIdentifier<QueryPipelineFilter>);
    if (!metadata.lifetime) registrations.services.addScoped(type);
}

/** Compile decorated commands and read models after registering their services. */
export function compileArtifacts(artifacts: readonly Artifact[], graph: ModelGraphValidator, registrations: ArtifactRegistrations,
    dependencies: ServiceIdentifier<unknown>[], commands: CommandDefinition<z.ZodType, unknown>[],
    queries: QueryDefinition<z.ZodType, unknown>[], observableQueries: ObservableQueryDefinition<z.ZodType, unknown>[]): void {
    for (const { type, namespace } of artifacts) {
        const metadata = ownMetadata(type);
        registerQueryExtension(type, metadata, registrations);
        registerResponseHandler(type, metadata, registrations);
        registerCommandFilter(type, metadata, registrations);
        registerQueryFilter(type, metadata, registrations);
        if (metadata.lifetime && !metadata.validatorTarget) {
            const registration = metadata.lifetime === ServiceLifetime.Singleton ? 'addSingleton' :
                metadata.lifetime === ServiceLifetime.Scoped ? 'addScoped' : 'addTransient';
            registrations.services[registration](type);
        }
        if (metadata.command) {
            const compiled = compileCommand(type, namespace, graph);
            commands.push(compiled.definition);
            dependencies.push(...compiled.dependencies);
        }
        if (metadata.readModel) for (const compiled of compileQueries(type, namespace, graph)) {
            if (compiled.observable) observableQueries.push(compiled.definition as ObservableQueryDefinition<z.ZodType, unknown>);
            else queries.push(compiled.definition as QueryDefinition<z.ZodType, unknown>);
            dependencies.push(...compiled.dependencies);
        }
    }
}
