// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from '../authorization/Authorization.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';

export type ClassType<T = unknown> = abstract new (...arguments_: never[]) => T;
export type WireType = ClassType & { valueType?: WireType };
export interface FieldOptions { optional?: boolean; nullable?: boolean; defaultValue?: unknown; values?: readonly (string | number | boolean)[] }
export interface ParameterArgument { readonly kind: 'argument'; readonly name: string; readonly type: WireType; readonly optional: boolean; readonly element?: WireType }
export interface ParameterService { readonly kind: 'service'; readonly token: ServiceIdentifier<unknown> }
export type Parameter = ParameterArgument | ParameterService;
export interface QueryMetadata { readonly parameters?: readonly Parameter[]; readonly observable: boolean; readonly argumentsModel?: ClassType; readonly authorization?: Authorization; readonly path?: string }
export interface ArtifactMetadata {
    command?: boolean;
    readModel?: boolean;
    namespace?: string;
    authorization?: Authorization;
    path?: string;
    injected?: readonly ServiceIdentifier<unknown>[];
    injectionDeclared?: boolean;
    queryMethods?: Map<string, QueryMetadata>;
    methodAuthorization?: Map<string, Authorization>;
    methodRoutes?: Map<string, string>;
    fieldOptions?: Map<string, FieldOptions>;
    lifetime?: 'singleton' | 'scoped' | 'transient';
    constructorTokens?: readonly ServiceIdentifier<unknown>[];
    validatorTarget?: ClassType;
}
const store = new WeakMap<object, ArtifactMetadata>();
export function metadataFor(target: object): ArtifactMetadata {
    let value = store.get(target);
    if (!value) { value = {}; store.set(target, value); }
    return value;
}
export function ownMetadata(type: ClassType): ArtifactMetadata {
    const standard = Symbol.metadata && Reflect.get(type, Symbol.metadata) as object | undefined;
    const legacy = store.get(type);
    const decorated = standard && store.get(standard);
    if (!legacy) return decorated ?? {};
    if (!decorated) return legacy;
    return { ...decorated, ...legacy };
}
export function memberMetadata(target: object, name: string, context?: { metadata?: DecoratorMetadataObject }): ArtifactMetadata {
    const owner = context ? context.metadata ?? target : typeof target === 'function' ? target : target.constructor;
    return metadataFor(owner);
}
export function setMemberAuthorization(target: object, name: string, authorization: Authorization, context?: { metadata?: DecoratorMetadataObject }): void {
    const metadata = memberMetadata(target, name, context);
    metadata.methodAuthorization = new Map(metadata.methodAuthorization);
    const existing = metadata.methodAuthorization.get(name) ?? {};
    metadata.methodAuthorization.set(name, { ...existing, ...authorization });
}
export function setClassAuthorization(target: ClassType, authorization: Authorization): void {
    const metadata = metadataFor(target);
    metadata.authorization = { ...metadata.authorization, ...authorization };
}
export function readFieldOptions(type: ClassType, name: string): FieldOptions {
    const chain: object[] = [];
    for (let current: object | null = type; current && current !== Function.prototype; current = Object.getPrototypeOf(current)) chain.unshift(current);
    const result: FieldOptions = {};
    for (const current of chain) {
        const standard = Symbol.metadata && Reflect.get(current, Symbol.metadata) as object | undefined;
        Object.assign(result, standard && store.get(standard)?.fieldOptions?.get(name), store.get(current)?.fieldOptions?.get(name));
    }
    return result;
}
