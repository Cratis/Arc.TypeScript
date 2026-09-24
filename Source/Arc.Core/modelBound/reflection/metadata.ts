// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from '../../authorization/Authorization.js';
import type { ArtifactMetadata } from './ArtifactMetadata.js';
import type { ClassType } from './ClassType.js';
import type { FieldOptions } from './FieldOptions.js';
export type { ArtifactMetadata } from './ArtifactMetadata.js';
export type { ClassType } from './ClassType.js';
export type { WireType } from './WireType.js';
export type { FieldOptions } from './FieldOptions.js';
export type { ParameterArgument } from '../queries/ParameterArgument.js';
export type { ParameterService } from '../queries/ParameterService.js';
export type { Parameter } from '../queries/Parameter.js';
export type { QueryMetadata } from '../queries/QueryMetadata.js';
const registryKey = Symbol.for('@cratis/arc.core/modelBound/metadata');
const store = (globalThis as typeof globalThis & { [registryKey]?: WeakMap<object, ArtifactMetadata> })[registryKey] ??=
    new WeakMap<object, ArtifactMetadata>();
/** Read or create Arc metadata for a decorated declaration. */
export function metadataFor(target: object): ArtifactMetadata {
    let value = store.get(target);
    if (!value) { value = {}; store.set(target, value); }
    return value;
}
/** Read Arc metadata from legacy or standard class decorators. */
export function ownMetadata(type: ClassType): ArtifactMetadata {
    const standard = Symbol.metadata && Reflect.get(type, Symbol.metadata) as object | undefined;
    const legacy = store.get(type);
    const decorated = standard && store.get(standard);
    if (!legacy) return decorated ?? {};
    if (!decorated) return legacy;
    return { ...decorated, ...legacy };
}
/** Store a method or field declaration on its owning class. */
export function memberMetadata(target: object, _name: string, context?: { metadata?: DecoratorMetadataObject }): ArtifactMetadata {
    const owner = context ? context.metadata ?? target : typeof target === 'function' ? target : target.constructor;
    return metadataFor(owner);
}
/** Add an independent authorization requirement for this member. */
export function setMemberAuthorization(target: object, name: string, authorization: Authorization,
    context?: { metadata?: DecoratorMetadataObject }): void {
    const metadata = memberMetadata(target, name, context);
    metadata.methodAuthorization = new Map(metadata.methodAuthorization);
    const existing = metadata.methodAuthorization.get(name);
    metadata.methodAuthorization.set(name, combineAuthorization(existing, authorization));
}
/** Add an independent authorization requirement for this class. */
export function setClassAuthorization(target: ClassType, authorization: Authorization): void {
    const metadata = metadataFor(target);
    metadata.authorization = combineAuthorization(metadata.authorization, authorization);
}
function combineAuthorization(existing: Authorization | undefined, requirement: Authorization): Authorization {
    if (!existing) return requirement;
    const requirements = existing.requirements ?? [existing];
    return {
        requirements: [...requirements, requirement],
        authenticated: requirements.some(item => item.authenticated) || requirement.authenticated,
        anonymous: requirements.some(item => item.anonymous) || requirement.anonymous
    };
}
/** Collect inherited field annotations in declaration order. */
export function readFieldOptions(type: ClassType, name: string): FieldOptions {
    const chain: object[] = [];
    for (let current: object | null = type; current && current !== Function.prototype;
        current = Object.getPrototypeOf(current)) chain.unshift(current);
    const result: FieldOptions = {};
    for (const current of chain) {
        const standard = Symbol.metadata && Reflect.get(current, Symbol.metadata) as object | undefined;
        Object.assign(result, standard && store.get(standard)?.fieldOptions?.get(name), store.get(current)?.fieldOptions?.get(name));
    }
    return result;
}
