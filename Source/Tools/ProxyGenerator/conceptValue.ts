// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { isTypeFrom } from './sourceSymbols.js';

/**
 * Walk the instantiated inheritance chain of a type to ConceptAs and return the type of its value,
 * or undefined when the type is not a concept.
 */
export function conceptValue(checker: ts.TypeChecker, type: ts.Type, location: ts.Node): ts.Type | undefined {
    const pending = [type];
    const visited = new Set<ts.Type>();
    while (pending.length) {
        const candidate = pending.pop()!;
        if (visited.has(candidate)) continue;
        visited.add(candidate);
        if (isTypeFrom(checker, candidate, 'ConceptAs', '@cratis/fundamentals')) {
            // The original instantiated property retains substitutions through generic intermediate bases.
            const value = checker.getPropertyOfType(type, 'value');
            return value && checker.getTypeOfSymbolAtLocation(value, location);
        }
        const reference = candidate.flags & ts.TypeFlags.Object && (candidate as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
            ? candidate as ts.TypeReference : undefined;
        pending.push(...candidate.getBaseTypes() ?? reference?.target.getBaseTypes() ?? []);
    }
    return undefined;
}
