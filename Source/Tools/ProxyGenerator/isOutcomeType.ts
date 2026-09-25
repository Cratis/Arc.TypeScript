// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { isPackageSymbol } from './sourceSymbols.js';

/** Identify an Outcome branch by its package-owned brand, including branches expanded from a union alias. */
export function isOutcomeType(type: ts.Type, checker: ts.TypeChecker): boolean {
    return type.getProperties().some(property => property.declarations?.some(declaration =>
        ts.isPropertySignature(declaration) && ts.isComputedPropertyName(declaration.name) &&
        isPackageSymbol(checker, declaration.name.expression, 'outcomeBrand', '@cratis/arc.core')));
}
