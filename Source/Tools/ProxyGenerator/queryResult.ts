// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { isStandardType, isTypeFrom } from './sourceSymbols.js';

function observableBase(type: ts.Type, checker: ts.TypeChecker, visited = new Set<ts.Type>()): ts.Type | undefined {
    if (visited.has(type)) return undefined;
    visited.add(type);
    if (isTypeFrom(checker, type, 'ObservableSource', '@cratis/arc.core') ||
        ['Observable', 'Subject', 'BehaviorSubject', 'ReplaySubject'].some(name => isTypeFrom(checker, type, name, 'rxjs')) ||
        isStandardType(type, 'AsyncIterable') || isStandardType(type, 'AsyncGenerator')) return type;
    for (const base of checker.getBaseTypes(type as ts.InterfaceType) ?? []) {
        const matched = observableBase(base, checker, visited);
        if (matched) return matched;
    }
    return undefined;
}

export function queryResult(type: ts.Type, checker: ts.TypeChecker, node: ts.Node): { type: ts.Type; observable: boolean; paged: boolean } {
    const current = checker.getAwaitedType(type) ?? type;
    const source = observableBase(current, checker);
    const paged = isTypeFrom(checker, current, 'QueryPage', '@cratis/arc.core');
    if (source || paged) {
        const wrapped = source ?? current;
        let argument = wrapped.aliasTypeArguments?.[0] ?? checker.getTypeArguments(wrapped as ts.TypeReference)[0];
        if (source && argument?.isTypeParameter()) {
            const parameters = (current as ts.TypeReference).target?.typeParameters ?? [];
            const index = parameters.indexOf(argument);
            if (index >= 0) argument = checker.getTypeArguments(current as ts.TypeReference)[index];
        }
        if (!argument) throw new Error(`${node.getSourceFile().fileName}: missing query result type`);
        return { type: argument, observable: !!source, paged };
    }
    return { type: current, observable: false, paged: false };
}
