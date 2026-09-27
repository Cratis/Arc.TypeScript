// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcOptions } from '../ArcOptions.js';
import type { ArcServer } from '../ArcServer.js';
import type { Artifact } from '../reflection/Artifact.js';
import type { ClassType } from '../reflection/ClassType.js';
import { ownMetadata } from '../reflection/ownMetadata.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import { createOwnedServiceScope } from '../dependencyInjection/ServiceScope.js';
import type { AuthorizationPolicy, AuthorizationPolicyRegistration } from '../authorization/AuthorizationPolicy.js';
import { readModelArgument } from '../commands/modelBound/commandReadModel.js';
import { BaseValidator } from '../validation/BaseValidator.js';
import { Severity } from '../validation/Severity.js';
import type { ReadModelForCommandResolver } from '../commands/ReadModelForCommandResolver.js';

/** Check compiled dependencies and read-model resolver bindings before the server is observed. */
export async function preflight(server: ArcServer, dependencies: ServiceIdentifier<unknown>[],
    validators: ReadonlyMap<ClassType, ClassType<BaseValidator<unknown>>>,
    policies: ReadonlyMap<string, AuthorizationPolicyRegistration>, artifacts: readonly Artifact[],
    options: ArcOptions, readModelResolvers: readonly ServiceIdentifier<ReadModelForCommandResolver>[]): Promise<void> {
    server.services.preflight([...dependencies, ...[...policies.values()].filter(
        (policy): policy is (abstract new (...arguments_: never[]) => AuthorizationPolicy) =>
            typeof policy.prototype?.authorize === 'function')]);
    const scope = createOwnedServiceScope(server.services, { correlationId: '', principal: undefined, tenantId: undefined,
        signal: new AbortController().signal, allowedSeverity: Severity.Error });
    try {
        const resolvers = await Promise.all([...options.readModelForCommandResolvers ?? [], ...readModelResolvers]
            .map(token => scope.resolve(token)));
        for (const { type } of artifacts) {
            const bindings = ownMetadata(type).injected;
            for (const token of [...bindings?.get('provide') ?? [], ...bindings?.get('handle') ?? []]) {
                const model = readModelArgument(token);
                if (!model) continue;
                const matching = resolvers.filter(resolver => resolver.supports(model.type));
                if (matching.length !== 1)
                    throw new Error(`Expected one read-model resolver for ${model.type.name}, found ${matching.length}`);
            }
        }
        for (const type of validators.values()) {
            const validator = await scope.resolve(type);
            if (!(validator instanceof BaseValidator)) throw new Error(`Invalid validator: ${type.name}`);
        }
    } finally { await scope.dispose(); }
}
