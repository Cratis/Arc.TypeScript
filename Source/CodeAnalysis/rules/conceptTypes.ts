// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import * as ts from 'typescript';

/** Determine whether a class really derives from Fundamentals ConceptAs. */
export function isConcept(checker: ts.TypeChecker, type: ts.Type): boolean {
    if (type.symbol?.name === 'ConceptAs' && type.symbol.declarations?.some(declaration =>
        /(?:@cratis\/fundamentals|fundamentals-npm)/i.test(declaration.getSourceFile().fileName))) return true;
    return type.isClassOrInterface() && checker.getBaseTypes(type).some(base => isConcept(checker, base));
}

/** Recognize primitives eligible for wire-level concept validation. */
export function isPrimitive(type: ts.Type): boolean {
    return !!(type.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike));
}
