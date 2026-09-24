// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { QueryDefinition } from '../queries/QueryDefinition.js';
import type { ObservableQueryDefinition } from '../queries/observable/ObservableQueryDefinition.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import { reflectedParameters, resolveAll } from './dependencies.js';
import { encodeObservable } from './encodeObservable.js';
import { ownMetadata, type ClassType, type Parameter } from './metadata.js';
import { decode, encode, schemaFor } from './wireSchema.js';

export interface CompiledQuery {
    readonly definition: QueryDefinition<z.ZodType, unknown> | ObservableQueryDefinition<z.ZodType, unknown>;
    readonly dependencies: readonly ServiceIdentifier<unknown>[];
    readonly observable: boolean;
}
export function compileQueries(type: ClassType, namespace: string): CompiledQuery[] {
    const metadata = ownMetadata(type);
    if (!metadata.readModel) throw new Error(`Not an Arc read model: ${type.name}`);
    const queries: CompiledQuery[] = [];
    for (const [name, declaration] of metadata.queryMethods ?? []) {
        const method: unknown = Reflect.get(type, name);
        if (typeof method !== 'function') throw new Error(`Query ${type.name}.${name} requires a static method`);
        let parameters: readonly Parameter[] = declaration.parameters ?? [];
        if (!declaration.parameters && method.length) {
            const inferred = reflectedParameters(type, name, method.length);
            parameters = inferred.map(token => ({ kind: 'service', token }));
        }
        if (method.length !== parameters.length) throw new Error(`Unbound parameters on ${type.name}.${name}`);
        const names = new Set<string>();
        const shape: Record<string, z.ZodType> = {};
        const services: ServiceIdentifier<unknown>[] = [];
        for (const parameter of parameters) {
            if (parameter.kind === 'service') services.push(parameter.token);
            else {
                const folded = parameter.name.toLowerCase();
                if (names.has(folded)) throw new Error(`Ambiguous query argument: ${type.name}.${name}.${parameter.name}`);
                names.add(folded);
                shape[parameter.name] = schemaFor(parameter.type, { optional: parameter.optional }, parameter.element);
            }
        }
        const authorization = metadata.methodAuthorization?.get(name) ?? metadata.authorization;
        if (authorization?.anonymous && (authorization.authenticated || authorization.roles?.length))
            throw new Error(`Conflicting Arc authorization: ${type.name}.${name}`);
        const perform = async (input: unknown): Promise<unknown> => {
            const values = input as Record<string, unknown>;
            const resolved = await resolveAll(services);
            let index = 0;
            const arguments_ = parameters.map(parameter => parameter.kind === 'service' ? resolved[index++] :
                decode(parameter.type, values[parameter.name], parameter.element));
            return method.apply(type, arguments_);
        };
        const descriptor = {
            name, namespace: [metadata.namespace ?? namespace, type.name].filter(Boolean).join('.'),
            routeNamespace: metadata.namespace ?? namespace,
            path: metadata.methodRoutes?.get(name) ?? metadata.path,
            authorization, schema: z.object(shape), wireInputSchema: z.toJSONSchema(z.object(shape), { io: 'input' }), handlerDependencies: services
        };
        if (declaration.observable) queries.push({
            definition: { ...descriptor, observe: async input => encodeObservable(await perform(input)) },
            dependencies: services, observable: true
        });
        else queries.push({
            definition: { ...descriptor, perform: async input => encode(await perform(input)) },
            dependencies: services, observable: false
        });
    }
    return queries;
}
