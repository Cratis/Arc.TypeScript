// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from './ClassType.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';

interface ReflectMetadata { getMetadata(key: string, target: object, member?: string): unknown }
/** Infer class-valued legacy decorator dependencies from emitted metadata. */
export function reflectedParameters(type: ClassType | object, member: string, count: number,
    offset = 0): readonly ServiceIdentifier<unknown>[] {
    const owner = typeof type === 'function' ? type.name : type.constructor.name;
    const reflection = Reflect as typeof Reflect & Partial<ReflectMetadata>;
    const parameters = member === 'constructor' ? reflection.getMetadata?.('design:paramtypes', type) :
        reflection.getMetadata?.('design:paramtypes', type, member);
    if (!Array.isArray(parameters)) throw new Error(`Missing parameter metadata for ${owner}.${member}; use explicit tokens`);
    const tokens = parameters.slice(offset) as unknown[];
    if (tokens.length !== count || tokens.some(token =>
        typeof token !== 'function' || token === Object || token === Function || token === Array))
        throw new Error(`Unresolvable parameter on ${owner}.${member}; use explicit tokens`);
    return tokens as ServiceIdentifier<unknown>[];
}
