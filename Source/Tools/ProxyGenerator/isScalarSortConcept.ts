// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { isStandardType, isTypeFrom } from './sourceSymbols.js';

function conceptValue(checker: ts.TypeChecker, type: ts.Type, location: ts.Node): ts.Type | undefined {
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

/** Classify concepts for sorting without resolving client types or discovering generated models. */
export function isScalarSortConcept(checker: ts.TypeChecker, type: ts.Type, location: ts.Node): boolean {
    const scalar = (candidate: ts.Type, visited = new Set<ts.Type>()): boolean => {
        if (visited.has(candidate)) return false;
        if (candidate.isUnion()) {
            const defined = candidate.types.filter(part => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
            return defined.length > 0 && defined.every(part => scalar(part, new Set(visited)));
        }
        if (candidate.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike)) return true;
        if (isStandardType(candidate, 'Date') || ['Guid', 'DateOnly', 'TimeOnly', 'TimeSpan'].some(name =>
            isTypeFrom(checker, candidate, name, '@cratis/fundamentals'))) return true;
        visited.add(candidate);
        const value = conceptValue(checker, candidate, location);
        return !!value && scalar(value, visited);
    };
    const defined = (type.isUnion() ? type.types : [type]).filter(part => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
    return defined.length > 0 && defined.every(part => {
        const value = conceptValue(checker, part, location);
        return !!value && scalar(value);
    });
}
