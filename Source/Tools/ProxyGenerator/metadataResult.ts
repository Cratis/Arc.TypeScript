// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { MetadataImports } from './MetadataImports.js';
import { isStandardType, isTypeFrom } from './sourceSymbols.js';

/** Describe result cardinality and element type without executing the method. */
export function metadataResult(type: ts.Type, checker: ts.TypeChecker, imports: MetadataImports, location: ts.Node,
    paged = false, observable?: boolean, includeElement = true, selectedParts?: readonly ts.Type[]): string {
    const parts = selectedParts ?? (type.isUnion() ? type.types : [type]);
    if (!parts.length) return "{ cardinality: 'void', nullable: true }";
    const nullable = parts.some(part => !!(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) ||
        parts.length > 1 && !!(part.flags & ts.TypeFlags.Void));
    const value = parts.find(part => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) &&
        !(parts.length > 1 && part.flags & ts.TypeFlags.Void)) ?? type;
    const many = checker.isArrayType(value);
    let element = many ? checker.getTypeArguments(value as ts.TypeReference)[0] ?? value : value;
    if (many && parts.length > 1 && parts.every(part => checker.isArrayType(part))) {
        const elements = parts.map(part => checker.getTypeArguments(part as ts.TypeReference)[0]);
        const concepts = elements.map(part => part?.getBaseTypes()?.find(base =>
            isTypeFrom(checker, base, 'ConceptAs', '@cratis/fundamentals')));
        if (elements.some(part => part !== elements[0]) && concepts.every((concept): concept is ts.BaseType => !!concept)) {
            const primitives = concepts.map(concept => checker.getTypeArguments(concept as ts.TypeReference)[0]);
            if (primitives[0] && primitives.every(primitive => primitive === primitives[0])) element = primitives[0];
        }
    }
    const cardinality = paged ? 'paged' : many ? 'many' : value.flags & ts.TypeFlags.Void ? 'void' : 'one';
    let token: string | undefined;
    if (!includeElement) return `{ cardinality: '${cardinality}', nullable: ${nullable} }`;
    const members = (element.isUnion() ? element.types : [element]).filter(part =>
        !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)));
    if (members.length && members.every(part => !!(part.flags & ts.TypeFlags.StringLike))) token = 'String';
    else if (members.length && members.every(part => !!(part.flags & ts.TypeFlags.NumberLike))) token = 'Number';
    else if (members.length && members.every(part => !!(part.flags & ts.TypeFlags.BooleanLike))) token = 'Boolean';
    else if (isStandardType(element, 'Date')) token = 'Date';
    else if (element.getSymbol()?.declarations?.some(ts.isClassDeclaration)) token = imports.classToken(element, location);
    return `{ cardinality: '${cardinality}', nullable: ${nullable}${token ? `, element: ${token}` : ''}` +
        `${observable === undefined ? '' : `, observable: ${observable}`} }`;
}
