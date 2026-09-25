// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { isPackageSymbol, isTypeFrom } from './sourceSymbols.js';

/** Select the one value that survives command response handlers, without resolving handled server types as client models. */
export function commandResponseType(type: ts.Type, checker: ts.TypeChecker, location: ts.Node): ts.Type | undefined {
    const fail = (message: string): never => {
        const position = location.getSourceFile().getLineAndCharacterOfPosition(location.getStart());
        throw new Error(`${location.getSourceFile().fileName}:${position.line + 1}:${position.character + 1}: ${message}`);
    };
    const select = (candidate: ts.Type): ts.Type | undefined => {
        const awaited = checker.getAwaitedType(candidate) ?? candidate;
        if (awaited !== candidate) return select(awaited);
        if (candidate.isUnion()) {
            const visible = candidate.types.map(select).filter((part): part is ts.Type => part !== undefined);
            if (!visible.length) return undefined;
            const first = visible[0]!;
            if (visible.some(part => !checker.isTypeAssignableTo(part, first) || !checker.isTypeAssignableTo(first, part)))
                return fail('Multiple unhandled command response types');
            return first;
        }
        if (candidate.flags & (ts.TypeFlags.Void | ts.TypeFlags.Null | ts.TypeFlags.Undefined)) return undefined;
        if (isTypeFrom(checker, candidate, 'EventSourceIdResponse', '@cratis/arc.chronicle')) {
            const value = candidate.getProperty('value');
            return value && select(checker.getTypeOfSymbolAtLocation(value, location));
        }
        if (['EventsWithConcurrencyScopes', 'AggregateRootCommitResult', 'RoutedEvent'].some(name =>
            isTypeFrom(checker, candidate, name, '@cratis/arc.chronicle'))) return undefined;
        if (['CommandOperation', 'CommandOperations'].some(name => isTypeFrom(checker, candidate, name, '@cratis/arc.core')) ||
            candidate.getBaseTypes()?.some(base => isTypeFrom(checker, base, 'CommandOperation', '@cratis/arc.core'))) return undefined;
        const declaration = candidate.getSymbol()?.declarations?.find(ts.isClassDeclaration);
        if (declaration && (ts.getDecorators(declaration) ?? []).some(decorator => {
            const expression = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
            return isPackageSymbol(checker, ts.isPropertyAccessExpression(expression) ? expression.name : expression, 'eventType', '@cratis/chronicle');
        })) return undefined;
        if (checker.isArrayType(candidate)) {
            const element = checker.getTypeArguments(candidate as ts.TypeReference)[0];
            if (element && (isTypeFrom(checker, element, 'CommandOperation', '@cratis/arc.core') ||
                element.getBaseTypes()?.some(base => isTypeFrom(checker, base, 'CommandOperation', '@cratis/arc.core'))))
                return fail('Use CommandOperations instead of returning an ordinary collection of operation declarations');
            if (element && select(element) === undefined) return undefined;
        }
        if (isTypeFrom(checker, candidate, 'ArcTuple', '@cratis/arc.core')) {
            const values = checker.getTypeArguments(candidate as ts.TypeReference)[0];
            if (!values || !checker.isTupleType(values)) return fail('Unsupported command response tuple');
            const visible = checker.getTypeArguments(values as ts.TypeReference).map(select).filter((part): part is ts.Type => part !== undefined);
            if (visible.length > 1) return fail('Multiple unhandled command response values');
            return visible[0];
        }
        return candidate;
    };
    return select(type);
}
