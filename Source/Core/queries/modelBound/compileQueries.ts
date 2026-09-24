// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { CompiledQuery } from './CompiledQuery.js';
import type { ServiceIdentifier } from '../../dependencyInjection/ServiceIdentifier.js';
import { reflectedParameters } from '../../reflection/reflectedParameters.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { ownMetadata } from '../../reflection/ownMetadata.js';
import { validateGeneratedReturn } from '../../reflection/validateGeneratedReturn.js';
import type { ClassType } from '../../reflection/ClassType.js';
import type { Parameter } from './Parameter.js';
import type { WireType } from '../../reflection/WireType.js';
import type { QueryMetadata } from './QueryMetadata.js';
import type { QueryOptions } from '../QueryOptions.js';
import type { ObservableSource } from '../observable/ObservableSource.js';
import { decode, fieldsFor, schemaFor } from '../../reflection/wireSchema.js';
import type { ModelGraphValidator } from '../../validation/ModelGraphValidator.js';

const argumentsOnly = (parameters: readonly Parameter[]): Extract<Parameter, { kind: 'argument' }>[] =>
    parameters.filter((parameter): parameter is Extract<Parameter, { kind: 'argument' }> => parameter.kind === 'argument');

function parametersFor(type: ClassType, name: string, declaration: QueryMetadata,
    method: (...parameters: unknown[]) => unknown): readonly Parameter[] {
    let parameters: readonly Parameter[] = declaration.parameters ?? [];
    if (!declaration.parameters && method.length) {
        parameters = reflectedParameters(type, name, method.length).map(token => ({ kind: 'service', token }));
    }
    if (method.length !== parameters.length && !(declaration.generated && method.length < parameters.length))
        throw new Error(`Unbound parameters on ${type.name}.${name}`);
    if (declaration.argumentsModel) {
        const declared = fieldsFor(declaration.argumentsModel as WireType);
        const arguments_ = argumentsOnly(parameters);
        if (declared.length !== arguments_.length || declared.some(field =>
            !arguments_.some(parameter => parameter.name === field.name && parameter.type === field.type)))
            throw new Error(`Query arguments model does not match ${type.name}.${name}`);
    }
    return parameters;
}

function inputFor(type: ClassType, name: string, parameters: readonly Parameter[]): {
    shape: Record<string, z.ZodType>; services: ServiceIdentifier<unknown>[]
} {
    const names = new Set<string>();
    const shape: Record<string, z.ZodType> = {};
    const services: ServiceIdentifier<unknown>[] = [];
    for (const parameter of parameters) {
        if (parameter.kind === 'service' && !parameter.optional) services.push(parameter.token);
        else if (parameter.kind === 'argument') {
            const folded = parameter.name.toLowerCase();
            if (names.has(folded)) throw new Error(`Ambiguous query argument: ${type.name}.${name}.${parameter.name}`);
            names.add(folded);
            shape[parameter.name] = schemaFor(parameter.type, { optional: parameter.optional }, parameter.element);
        }
    }
    return { shape, services };
}

async function validateInput(parameters: readonly Parameter[], declaration: QueryMetadata, graph: ModelGraphValidator,
    input: unknown, context: { signal: AbortSignal; correlationId: string }) {
    const values = input as Record<string, unknown>;
    const arguments_ = argumentsOnly(parameters);
    const decoded = Object.fromEntries(arguments_.map(parameter => [parameter.name,
        decode(parameter.type, values[parameter.name], parameter.element)]));
    if (declaration.argumentsModel) {
        const model = Object.assign(Reflect.construct(declaration.argumentsModel, []), decoded);
        return graph.validate(model, context.signal, '', context.correlationId);
    }
    const results = [];
    for (const parameter of arguments_) {
        const value = decoded[parameter.name];
        if (value != null) results.push(...await graph.validate(value, context.signal, parameter.name, context.correlationId));
    }
    return results;
}

function compileQuery(type: ClassType, namespace: string, name: string, declaration: QueryMetadata,
    graph?: ModelGraphValidator): CompiledQuery {
    const metadata = ownMetadata(type);
    const method: unknown = Reflect.get(type, name);
    if (typeof method !== 'function') throw new Error(`Query ${type.name}.${name} requires a static method`);
    const parameters = parametersFor(type, name, declaration, method as (...parameters: unknown[]) => unknown);
    if (declaration.result && declaration.result.observable !== undefined && declaration.result.observable !== declaration.observable)
        throw new Error(`Query ${type.name}.${name} observable declaration does not match its generated return metadata`);
    if (declaration.result?.cardinality === 'paged' && declaration.observable)
        throw new Error(`Query ${type.name}.${name} cannot return an observable page`);
    const { shape, services } = inputFor(type, name, parameters);
    const authorization = metadata.methodAuthorization?.get(name) ?? metadata.authorization;
    if (authorization?.anonymous && (authorization.authenticated || authorization.roles?.length))
        throw new Error(`Conflicting Arc authorization: ${type.name}.${name}`);
    const perform = async (input: unknown, options: QueryOptions): Promise<unknown> => {
        const values = input as Record<string, unknown>;
        const scope = currentServices();
        const arguments_ = await Promise.all(parameters.map(parameter => parameter.kind === 'service' ?
            parameter.optional && !scope.registry.hasRegistration(parameter.token) ? null : scope.resolve(parameter.token) :
            parameter.kind === 'options' ? options : decode(parameter.type, values[parameter.name], parameter.element)));
        return method.apply(type, arguments_);
    };
    const descriptor = {
        name, namespace: [metadata.namespace ?? namespace, type.name].filter(Boolean).join('.'),
        routeNamespace: metadata.namespace ?? namespace,
        path: metadata.methodRoutes?.get(name) ?? metadata.path,
        authorization, schema: z.object(shape), wireOutput: true, wireType: type,
        wireInputSchema: z.toJSONSchema(z.object(shape), { io: 'input' }), handlerDependencies: services,
        validate: graph ? (input: unknown, context: { signal: AbortSignal; correlationId: string }) =>
            validateInput(parameters, declaration, graph, input, context) : undefined
    };
    if (declaration.observable) return {
        definition: { ...descriptor, observe: async (input, _context, options) => await perform(input, options) as ObservableSource<unknown> },
        dependencies: services, observable: true
    };
    return {
        definition: { ...descriptor, perform: async (input, _context, options) => {
            const value = await perform(input, options);
            validateGeneratedReturn(`${type.name}.${name}`, declaration.result, value);
            if (value && typeof value === 'object' &&
                (Symbol.asyncIterator in value || 'subscribe' in value && typeof value.subscribe === 'function')) {
                throw new Error(`Snapshot query ${type.name}.${name} returned an observable`);
            }
            return value;
        } },
        dependencies: services, observable: false
    };
}

/** Compile static read-model queries onto Arc's query pipelines. */
export function compileQueries(type: ClassType, namespace: string, graph?: ModelGraphValidator): CompiledQuery[] {
    const metadata = ownMetadata(type);
    if (!metadata.readModel) throw new Error(`Not an Arc read model: ${type.name}`);
    return [...metadata.queryMethods ?? []].map(([name, declaration]) => compileQuery(type, namespace, name, declaration, graph));
}
