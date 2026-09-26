// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { isPackageSymbol, isStandardType, isTypeFrom } from './sourceSymbols.js';
import { isOutcomeType } from './isOutcomeType.js';

/** A path is one possible execution; members of a path are returned together, not alternatives. */
export type CommandResponsePath = { readonly members: readonly ts.Type[]; readonly response?: ts.Type };
export type CommandResponseDescriptor = { readonly paths: readonly CommandResponsePath[]; readonly response?: ts.Type };

/** Analyze all command return paths before choosing the one client decoder shared by them. */
export function describeCommandResponse(type: ts.Type, checker: ts.TypeChecker, location: ts.Node): CommandResponseDescriptor {
    const fail = (message: string): never => {
        const position = location.getSourceFile().getLineAndCharacterOfPosition(location.getStart());
        throw new Error(`${location.getSourceFile().fileName}:${position.line + 1}:${position.character + 1}: ${message}`);
    };
    const visible = (candidate: ts.Type): boolean => {
        if (candidate.flags & (ts.TypeFlags.Void | ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Never)) return false;
        if (['EventsWithConcurrencyScopes', 'AggregateRootCommitResult', 'RoutedEvent'].some(name =>
            isTypeFrom(checker, candidate, name, '@cratis/arc.chronicle'))) return false;
        if (['CommandOperation', 'CommandOperations'].some(name => isTypeFrom(checker, candidate, name, '@cratis/arc.core')) ||
            candidate.getBaseTypes()?.some(base => isTypeFrom(checker, base, 'CommandOperation', '@cratis/arc.core'))) return false;
        const declaration = candidate.getSymbol()?.declarations?.find(ts.isClassDeclaration);
        if (declaration && (ts.getDecorators(declaration) ?? []).some(decorator => {
            const expression = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
            return isPackageSymbol(checker, ts.isPropertyAccessExpression(expression) ? expression.name : expression,
                'eventType', '@cratis/chronicle');
        })) return false;
        if (checker.isArrayType(candidate)) {
            const element = checker.getTypeArguments(candidate as ts.TypeReference)[0];
            if (element && (isTypeFrom(checker, element, 'CommandOperation', '@cratis/arc.core') ||
                element.getBaseTypes()?.some(base => isTypeFrom(checker, base, 'CommandOperation', '@cratis/arc.core'))))
                return fail('Use CommandOperations instead of returning an ordinary collection of operation declarations');
            if (element && (element.isUnion() ? element.types : [element]).some(part => isOutcomeType(part, checker)))
                return fail('Return an Outcome for the entire command response, not an array of Outcome values');
            if (element && (element.isUnion() ? element.types.every(part => !visible(part)) : !visible(element))) return false;
        }
        return true;
    };
    // A type's client representation is its decoder and cardinality, not its structural assignability.
    // In particular, two unrelated DTO classes with the same fields require different constructors.
    const representation = (candidate: ts.Type): string => {
        if (checker.isArrayType(candidate)) {
            const element = checker.getTypeArguments(candidate as ts.TypeReference)[0];
            return `array:${element ? representation(element) : '?'}`;
        }
        if (candidate.flags & ts.TypeFlags.StringLike) return 'String';
        if (candidate.flags & ts.TypeFlags.NumberLike) return 'Number';
        if (candidate.flags & ts.TypeFlags.BooleanLike) return 'Boolean';
        const symbol = candidate.aliasSymbol ?? candidate.getSymbol();
        if (isStandardType(candidate, 'Date')) return 'Date';
        const base = candidate.getBaseTypes()?.find(part => isTypeFrom(checker, part, 'ConceptAs', '@cratis/fundamentals'));
        if (base) {
            const value = checker.getTypeArguments(base as ts.TypeReference)[0];
            if (value) return representation(value);
        }
        return `type:${symbol ? checker.getFullyQualifiedName(symbol) : checker.typeToString(candidate)}`;
    };
    const paths = (candidate: ts.Type): ts.Type[][] => {
        const awaited = checker.getAwaitedType(candidate) ?? candidate;
        if (awaited !== candidate) return paths(awaited);
        // TypeScript expands Outcome<T> in mixed unions; the package-owned brand identifies its branches.
        if (isOutcomeType(candidate, checker)) {
            const kind = candidate.getProperty('kind');
            const kindType = kind && checker.getTypeOfSymbolAtLocation(kind, location);
            if (kindType?.isStringLiteral() && kindType.value === 'response') {
                const value = candidate.getProperty('value');
                return value ? paths(checker.getTypeOfSymbolAtLocation(value, location)) : [[]];
            }
            if (kindType?.isStringLiteral() && (kindType.value === 'validation' || kindType.value === 'denied')) return [[]];
        }
        // A literal union has one decoder (the primitive or enum), not one alternative per literal.
        if (candidate.isUnion()) {
            if (candidate.types.every(part => !!(part.flags &
                (ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.BooleanLiteral))))
                return visible(candidate) ? [[candidate]] : [[]];
            return candidate.types.flatMap(paths);
        }
        if (isTypeFrom(checker, candidate, 'EventSourceIdResponse', '@cratis/arc.chronicle')) {
            const value = candidate.getProperty('value');
            return value ? paths(checker.getTypeOfSymbolAtLocation(value, location)) : [[]];
        }
        if (isTypeFrom(checker, candidate, 'ArcTuple', '@cratis/arc.core')) {
            const values = checker.getTypeArguments(candidate as ts.TypeReference)[0];
            if (!values || !checker.isTupleType(values)) return fail('Unsupported command response tuple');
            return checker.getTypeArguments(values as ts.TypeReference).reduce<ts.Type[][]>((groups, member) =>
                groups.flatMap(group => paths(member).map(path => [...group, ...path])), [[]]);
        }
        return visible(candidate) ? [[candidate]] : [[]];
    };
    const alternatives = paths(type).map(members => {
        if (members.length > 1) return fail('Multiple unhandled command response values');
        return { members, response: members[0] };
    });
    const responses = alternatives.flatMap(path => path.response ? [path.response] : []);
    const first = responses[0];
    if (first && responses.some(part => representation(part) !== representation(first)))
        return fail('Multiple unhandled command response types; return one response DTO with an application-owned status field');
    // Distinct concepts sharing a wire representation have no single concept token for metadata.
    const concepts = responses.flatMap(part => part.getBaseTypes()?.filter(base =>
        isTypeFrom(checker, base, 'ConceptAs', '@cratis/fundamentals')) ?? []);
    const primitive = responses.some(part => part !== first) && concepts.length ?
        checker.getTypeArguments(concepts[0] as ts.TypeReference)[0] : undefined;
    // Prefer the broad type when a literal and its primitive appear on separate paths.
    const response = primitive ?? responses.find(part => part === first && !(part.flags &
        (ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.BooleanLiteral))) ??
        responses.find(part => !(part.flags & (ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral | ts.TypeFlags.BooleanLiteral))) ?? first;
    return { paths: alternatives, response };
}

/** Select the single client-visible return type shared by every execution path. */
export function commandResponseType(type: ts.Type, checker: ts.TypeChecker, location: ts.Node): ts.Type | undefined {
    return describeCommandResponse(type, checker, location).response;
}
