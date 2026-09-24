// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { isStandardType, isTypeFrom } from './sourceSymbols.js';

export function queryResult(type: ts.Type, checker: ts.TypeChecker, node: ts.Node): { type: ts.Type; observable: boolean; paged: boolean } {
    const current = checker.getAwaitedType(type) ?? type;
    const observable = isTypeFrom(checker, current, 'ObservableSource', '@cratis/arc.core') ||
        ['Observable', 'Subject', 'BehaviorSubject', 'ReplaySubject'].some(name => isTypeFrom(checker, current, name, 'rxjs')) ||
        isStandardType(current, 'AsyncIterable') || isStandardType(current, 'AsyncGenerator');
    const paged = isTypeFrom(checker, current, 'QueryPage', '@cratis/arc.core');
    if (observable || paged) {
        const argument = current.aliasTypeArguments?.[0] ?? checker.getTypeArguments(current as ts.TypeReference)[0];
        if (!argument) throw new Error(`${node.getSourceFile().fileName}: missing query result type`);
        return { type: argument, observable, paged };
    }
    return { type: current, observable: false, paged: false };
}
