// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { conceptValue } from './conceptValue.js';
import { isStandardType, isTypeFrom } from './sourceSymbols.js';

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
