// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { MetadataImports } from './MetadataImports.js';

/** Describe result cardinality and element type without executing the method. */
export function metadataResult(type: ts.Type, checker: ts.TypeChecker, imports: MetadataImports, location: ts.Node,
    paged = false, observable?: boolean, includeElement = true, selectedParts?: readonly ts.Type[]): string {
    const parts = selectedParts ?? (type.isUnion() ? type.types : [type]);
    if (!parts.length) return "{ cardinality: 'void', nullable: true }";
    const nullable = parts.some(part => !!(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
    const value = parts.find(part => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined))) ?? type;
    const many = checker.isArrayType(value);
    const element = many ? checker.getTypeArguments(value as ts.TypeReference)[0] ?? value : value;
    const cardinality = paged ? 'paged' : many ? 'many' : value.flags & ts.TypeFlags.Void ? 'void' : 'one';
    let token: string | undefined;
    if (!includeElement) return `{ cardinality: '${cardinality}', nullable: ${nullable} }`;
    if (element.flags & ts.TypeFlags.StringLike) token = 'String';
    else if (element.flags & ts.TypeFlags.NumberLike) token = 'Number';
    else if (element.flags & ts.TypeFlags.BooleanLike) token = 'Boolean';
    else if (element.getSymbol()?.getName() === 'Date') token = 'Date';
    else if (element.getSymbol()?.declarations?.some(ts.isClassDeclaration)) token = imports.classToken(element, location);
    return `{ cardinality: '${cardinality}', nullable: ${nullable}${token ? `, element: ${token}` : ''}` +
        `${observable === undefined ? '' : `, observable: ${observable}`} }`;
}
