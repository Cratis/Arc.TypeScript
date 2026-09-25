// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { annotation, roles, stringArgument } from './sourceAnnotations.js';
import { identifier, isPackageSymbol, originalSymbol } from './sourceSymbols.js';
import { queryResult } from './queryResult.js';
import { warningOption, httpMethodOption } from './sourceOperationOptions.js';
import type { SourceField } from './SourceField.js';
import type { SourceOperation } from './SourceOperation.js';
import type { SourceType } from './SourceType.js';
import type { SourceTypeResolver } from './SourceTypeResolver.js';

function isOptionalBound(parameter: ts.ParameterDeclaration, option: ts.Expression | undefined): boolean {
    return !!parameter.questionToken || !!parameter.initializer || !!option && ts.isObjectLiteralExpression(option) &&
        option.properties.some(property => ts.isPropertyAssignment(property) && property.name.getText() === 'optional' &&
            property.initializer.kind === ts.SyntaxKind.TrueKeyword);
}

function boundParameters(member: ts.MethodDeclaration, explicit: readonly ts.Expression[], checker: ts.TypeChecker,
    resolver: SourceTypeResolver, path: string, hasMetadata: boolean, experimentalDecorators: boolean): SourceField[] {
    const parameters: SourceField[] = [];
    for (const parameter of member.parameters) {
        const parameterName = parameter.name.getText();
        if (!identifier.test(parameterName)) throw new Error(`${path}: unsupported generated identifier ${parameterName}`);
        const binding = explicit.find(item => ts.isCallExpression(item) &&
            isPackageSymbol(checker, item.expression, 'argument', '@cratis/arc.core') && item.arguments[0] &&
            ts.isStringLiteral(item.arguments[0]) && item.arguments[0].text === parameterName);
        if (!binding) {
            const serviceBinding = explicit.some(item => ts.isCallExpression(item) &&
                isPackageSymbol(checker, item.expression, 'service', '@cratis/arc.core') && item.arguments[0] &&
                originalSymbol(checker, item.arguments[0]) === checker.getTypeAtLocation(parameter).symbol);
            const type = checker.getTypeAtLocation(parameter);
            const actual = type.isUnion() ? type.types.find(part =>
                !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined))) ?? type : type;
            const declaration = actual.symbol?.declarations?.find(ts.isClassDeclaration);
            const inferredService = !explicit.length && !!declaration && !declaration.members.some(member =>
                !!annotation(checker, member, 'field', 'fundamentals')) &&
                !actual.getBaseTypes()?.some(base => base.symbol?.getName() === 'ConceptAs');
            if (hasMetadata && !explicit.length && !inferredService) {
                const optional = !!parameter.questionToken || !!parameter.initializer || type.isUnion() &&
                    type.types.some(part => !!(part.flags & ts.TypeFlags.Undefined));
                parameters.push({ name: parameterName, type: resolver.resolve(type, parameter, optional), optional });
                continue;
            }
            if (!serviceBinding && !(inferredService && (hasMetadata || experimentalDecorators))) {
                const line = member.getSourceFile().getLineAndCharacterOfPosition(parameter.getStart()).line + 1;
                throw new Error(`${path}:${line}: unbound query parameter ${parameterName}`);
            }
            continue;
        }
        const option = binding && ts.isCallExpression(binding) ? binding.arguments[2] : undefined;
        const optional = isOptionalBound(parameter, option);
        parameters.push({ name: parameterName,
            type: resolver.resolve(checker.getTypeAtLocation(parameter), parameter, optional), optional });
    }
    return parameters;
}

function conceptParameters(member: ts.MethodDeclaration, parameters: readonly SourceField[], checker: ts.TypeChecker):
    { name: string; symbol: ts.Symbol }[] {
    return member.parameters.filter(parameter => parameters.some(field => field.name === parameter.name.getText())).flatMap(parameter => {
        const symbol = checker.getTypeAtLocation(parameter).getSymbol();
        return symbol && ts.isIdentifier(parameter.name) ? [{ name: parameter.name.text, symbol }] : [];
    });
}

function argumentsModelSymbol(explicit: readonly ts.Expression[], checker: ts.TypeChecker): ts.Symbol | undefined {
    const options = explicit[0];
    const model = options && ts.isObjectLiteralExpression(options) ? options.properties.find(property =>
        ts.isPropertyAssignment(property) && property.name.getText() === 'argumentsModel') : undefined;
    return model && ts.isPropertyAssignment(model) ? originalSymbol(checker, model.initializer) : undefined;
}

/** Collect query declarations and their bound arguments from one read model. */
export function collectSourceQueries(declaration: ts.ClassDeclaration, checker: ts.TypeChecker, program: ts.Program,
    resolver: SourceTypeResolver, path: string, namespace: string, owner: string, pathOverride: string | undefined,
    classRoles: ReturnType<typeof roles>, hasMetadata: boolean, operations: SourceOperation[],
    targets: Map<string, ts.Symbol>, concepts: Map<string, { name: string; symbol: ts.Symbol }[]>): void {
    for (const member of declaration.members) {
        if (!ts.isMethodDeclaration(member) || !annotation(checker, member, 'query')) continue;
        const name = member.name.getText();
        if (!identifier.test(name)) throw new Error(`${path}: unsupported generated identifier ${name}`);
        const queryAnnotation = annotation(checker, member, 'query');
        const explicit = queryAnnotation && ts.isCallExpression(queryAnnotation) ? queryAnnotation.arguments : [];
        const queryKey = [namespace, owner, name].filter(Boolean).join('.');
        const modelSymbol = argumentsModelSymbol(explicit, checker);
        if (modelSymbol) targets.set(queryKey, modelSymbol);
        const parameters = boundParameters(member, explicit, checker, resolver, path, hasMetadata,
            program.getCompilerOptions().experimentalDecorators === true);
        concepts.set(queryKey, conceptParameters(member, parameters, checker));
        const signature = checker.getSignatureFromDeclaration(member);
        if (!signature) throw new Error(`${path}: missing query signature ${name}`);
        const result = queryResult(checker.getReturnTypeOfSignature(signature), checker, member);
        const options = explicit[0];
        const declaredObservable = options && ts.isObjectLiteralExpression(options) && options.properties.some(property =>
            ts.isPropertyAssignment(property) && property.name.getText() === 'observable' &&
                property.initializer.kind === ts.SyntaxKind.TrueKeyword);
        if (result.observable !== !!declaredObservable && (!hasMetadata || !!declaredObservable))
            throw new Error(`${path}: ${owner}.${name} observable return must match @query({ observable: true })`);
        const element = resolver.resolve(result.type, member);
        if (result.paged && (element.enumerable || element.void || element.nullable))
            throw new Error(`${path}:${member.getSourceFile().getLineAndCharacterOfPosition(member.getStart()).line + 1}: ` +
                'Unsupported paged query element');
        const response: SourceType = result.paged ? { ...element, text: `${element.text}[]`, enumerable: true } : element;
        operations.push({ kind: result.observable ? 'observable' : 'query', name, owner, namespace,
            treatWarningsAsErrors: warningOption(queryAnnotation, checker), httpMethod: httpMethodOption(queryAnnotation, checker),
            routeOverride: stringArgument(annotation(checker, member, 'path') ?? annotation(checker, member, 'route')) ?? pathOverride,
            roles: annotation(checker, member, 'allowAnonymous') || annotation(checker, member, 'authorize') ||
                annotation(checker, member, 'roles') ? roles(checker, member) : classRoles, fields: parameters, result: response });
    }
}
