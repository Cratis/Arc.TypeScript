// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { isStandardType, isTypeFrom } from './sourceSymbols.js';

function observableBase(type: ts.Type, checker: ts.TypeChecker, visited = new Set<ts.Type>()): ts.Type[] | undefined {
    if (visited.has(type)) return undefined;
    visited.add(type);
    if (isTypeFrom(checker, type, 'ObservableSource', '@cratis/arc.core') ||
        ['Observable', 'Subject', 'BehaviorSubject', 'ReplaySubject'].some(name => isTypeFrom(checker, type, name, 'rxjs')) ||
        isStandardType(type, 'AsyncIterable') || isStandardType(type, 'AsyncGenerator')) return [type];
    for (const base of checker.getBaseTypes(type as ts.InterfaceType) ?? []) {
        const matched = observableBase(base, checker, visited);
        if (matched) return [type, ...matched];
    }
    return undefined;
}

function hasTypeParameter(type: ts.Type, checker: ts.TypeChecker, visited = new Set<ts.Type>()): boolean {
    if (type.flags & ts.TypeFlags.TypeParameter) return true;
    if (visited.has(type)) return false;
    visited.add(type);
    const parts = type.isUnionOrIntersection() ? type.types :
        type.aliasTypeArguments ?? (type.flags & ts.TypeFlags.Object && (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference ?
            checker.getTypeArguments(type as ts.TypeReference) : []);
    return parts.some(part => hasTypeParameter(part, checker, visited));
}

export function queryResult(type: ts.Type, checker: ts.TypeChecker, node: ts.Node): { type: ts.Type; observable: boolean; paged: boolean } {
    const current = checker.getAwaitedType(type) ?? type;
    const source = observableBase(current, checker);
    const paged = isTypeFrom(checker, current, 'QueryPage', '@cratis/arc.core');
    if (source || paged) {
        const wrapped = source?.at(-1) ?? current;
        let argument = wrapped.aliasTypeArguments?.[0] ?? checker.getTypeArguments(wrapped as ts.TypeReference)[0];
        if (!argument) throw new Error(`${node.getSourceFile().fileName}: missing query result type`);
        for (const parent of source?.slice(0, -1).reverse() ?? []) {
            if (!(argument.flags & ts.TypeFlags.TypeParameter)) break;
            const reference = parent as ts.TypeReference;
            const index: number = reference.target?.typeParameters?.indexOf(argument) ?? -1;
            if (index >= 0) argument = checker.getTypeArguments(reference)[index] ?? argument;
        }
        if (source && hasTypeParameter(argument, checker))
            throw new Error(`${node.getSourceFile().fileName}: cannot resolve observable query result type; annotate the return as Observable<...>`);
        return { type: argument, observable: !!source, paged };
    }
    return { type: current, observable: false, paged: false };
}
