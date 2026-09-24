// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { annotation } from './sourceAnnotations.js';
import { isStandardType, isTypeFrom } from './sourceSymbols.js';
import { MetadataImports } from './MetadataImports.js';

function defined(type: ts.Type, parameter: ts.ParameterDeclaration): ts.Type {
    if (!type.isUnion()) return type;
    const parts = type.types.filter(part => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
    const classes = parts.filter(part => part.getSymbol()?.declarations?.some(ts.isClassDeclaration));
    if (classes.length > 1) {
        const file = parameter.getSourceFile();
        throw new Error(`${file.fileName}:${file.getLineAndCharacterOfPosition(parameter.getStart()).line + 1}: ` +
            `Cannot infer ${parameter.name.getText()}: union of multiple classes requires an explicit binding`);
    }
    return parts[0] ?? type;
}
function wire(type: ts.Type, checker: ts.TypeChecker, imports: MetadataImports): string | undefined {
    if (type.flags & ts.TypeFlags.StringLike) return 'String';
    if (type.flags & ts.TypeFlags.NumberLike) return 'Number';
    if (type.flags & ts.TypeFlags.BooleanLike) return 'Boolean';
    if (isStandardType(type, 'Date')) return 'Date';
    for (const name of ['Guid', 'DateOnly', 'TimeOnly', 'TimeSpan']) {
        if (isTypeFrom(checker, type, name, '@cratis/fundamentals')) return imports.fundamental(name as 'Guid' | 'DateOnly' | 'TimeOnly' | 'TimeSpan');
    }
    return undefined;
}
/** Analyze an undecorated parameter into an ordered runtime binding. */
export function metadataParameter(parameter: ts.ParameterDeclaration, checker: ts.TypeChecker, imports: MetadataImports,
    context: 'handle' | 'provide' | 'query'): string {
    if (!ts.isIdentifier(parameter.name) || parameter.dotDotDotToken)
        throw new Error(`${parameter.getSourceFile().fileName}: generated bindings require named, non-rest parameters`);
    const type = checker.getTypeAtLocation(parameter);
    const actual = defined(type, parameter);
    const name = parameter.name.text;
    const optional = !!parameter.questionToken || !!parameter.initializer || type.isUnion() &&
        type.types.some(part => !!(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
    if (context !== 'query') {
        if (isTypeFrom(checker, actual, 'CommandContext', '@cratis/arc.core')) return 'commandContext()';
        if (isStandardType(actual, 'AbortSignal')) return 'abortSignal()';
        const declaration = actual.getSymbol()?.declarations?.find(ts.isClassDeclaration);
        if (declaration && annotation(checker, declaration, 'readModel')) {
            const token = imports.classToken(actual, parameter);
            return `commandReadModel(${token}${type.isUnion() && type.types.some(part => !!(part.flags & ts.TypeFlags.Null)) ? ', { optional: true }' : ''})`;
        }
        const token = imports.classToken(actual, parameter);
        return optional ? `optionalService(${token})` : token;
    }
    if (isTypeFrom(checker, actual, 'QueryOptions', '@cratis/arc.core')) return `{ kind: 'options' }`;
    const element = checker.isArrayType(actual) ? checker.getTypeArguments(actual as ts.TypeReference)[0] : undefined;
    const item = element ?? actual;
    let token = wire(item, checker, imports);
    const base = item.getBaseTypes()?.find(candidate => isTypeFrom(checker, candidate, 'ConceptAs', '@cratis/fundamentals'));
    if (!token && (base || item.getSymbol()?.declarations?.some(ts.isClassDeclaration))) {
        const declaration = item.getSymbol()?.declarations?.find(ts.isClassDeclaration);
        if (base || declaration && (declaration.members.some(member => !!annotation(checker, member, 'field', 'fundamentals')) ||
            !!annotation(checker, declaration, 'readModel'))) token = imports.classToken(item, parameter);
        else if (element) throw new Error(`${parameter.getSourceFile().fileName}: unsupported array argument ${name}`);
        else return `{ kind: 'service', token: ${imports.classToken(item, parameter)}, optional: ${optional} }`;
    }
    if (!token) throw new Error(`${parameter.getSourceFile().fileName}:${parameter.getSourceFile().getLineAndCharacterOfPosition(parameter.getStart()).line + 1}: ` +
        `Cannot bind query parameter ${name}: only concrete class tokens are injectable without an explicit token`);
    return `{ kind: 'argument', name: ${JSON.stringify(name)}, type: ${element ? 'Array' : token}, optional: ${optional}${element ? `, element: ${token}` : ''} }`;
}
