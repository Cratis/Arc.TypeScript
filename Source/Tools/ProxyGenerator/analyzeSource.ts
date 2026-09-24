// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { dirname, relative, resolve, sep } from 'node:path';
import { discoveryFiles } from '@cratis/arc.core';
import { identifier, isPackageSymbol, originalSymbol } from './sourceSymbols.js';
import { annotation, classChain, fieldsFor, roles, stringArgument } from './sourceAnnotations.js';
import { queryResult } from './queryResult.js';
import ts from 'typescript';
import { SourceTypeResolver } from './SourceTypeResolver.js';
import type { SourceAnalysis } from './SourceAnalysis.js';
import type { SourceField } from './SourceField.js';
import type { SourceOperation } from './SourceOperation.js';
import type { SourceType } from './SourceType.js';
import { extractValidatorRules, type ValidatorRules } from './extractValidatorRules.js';
import type { RecordedRule } from './RecordedRule.js';
import { sourceProgram } from './sourceProgram.js';

export function analyzeSource(project: string, artifacts: string, rootNamespace = '', generatedMetadata = false,
    program = sourceProgram(project)): SourceAnalysis {
    const checker = program.getTypeChecker();
    const root = resolve(artifacts);
    const hasMetadata = generatedMetadata;
    const resolver = new SourceTypeResolver(checker, root, hasMetadata);
    const diagnostics: string[] = [];
    const discovered = new Set(discoveryFiles(root).map(file => resolve(file)));
    const operations: SourceOperation[] = [];
    const validators: ValidatorRules[] = [];
    const targets = new Map<string, ts.Symbol>();
    const concepts = new Map<string, { name: string; symbol: ts.Symbol }[]>();
    for (const file of program.getSourceFiles()) {
        const path = resolve(file.fileName);
        if (file.isDeclarationFile || !discovered.has(path)) continue;
        const module = checker.getSymbolAtLocation(file);
        const exports = new Set(module ? checker.getExportsOfModule(module).map(symbol =>
            symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol) : []);
        for (const declaration of file.statements) {
            if (!ts.isClassDeclaration(declaration) || !declaration.name || !exports.has(checker.getSymbolAtLocation(declaration.name)!)) continue;
            const validator = annotation(checker, declaration, 'validator');
            const explicitTarget = validator && ts.isCallExpression(validator) && validator.arguments[0] ?
                originalSymbol(checker, validator.arguments[0]) : undefined;
            const inheritedTarget = hasMetadata && !validator ? declaration.heritageClauses?.flatMap(clause => clause.types)
                .filter(base => ['CommandValidator', 'QueryValidator', 'ConceptValidator', 'ModelValidator'].some(name =>
                    isPackageSymbol(checker, base.expression, name, '@cratis/arc.core')))
                .map(base => base.typeArguments?.[0] && checker.getTypeFromTypeNode(base.typeArguments[0]).getSymbol())[0] : undefined;
            const target = explicitTarget || inheritedTarget;
            if (target) validators.push(extractValidatorRules(declaration, target));
            if (annotation(checker, declaration, 'derivedType', 'fundamentals'))
                resolver.resolve(checker.getTypeAtLocation(declaration), declaration);
            const isCommand = !!annotation(checker, declaration, 'command');
            const isModel = !!annotation(checker, declaration, 'readModel');
            if (!isCommand && !isModel) continue;
            const namespace = stringArgument(annotation(checker, declaration, isCommand ? 'command' : 'readModel'), 'namespace') ??
                [rootNamespace, ...relative(root, dirname(path)).split(sep).filter(value => value && value !== '.')].filter(Boolean).join('.');
            const owner = declaration.name.text;
            const key = [namespace, owner].filter(Boolean).join('.');
            const classSymbol = checker.getSymbolAtLocation(declaration.name);
            if (isCommand && classSymbol) targets.set(key, classSymbol);
            const pathOverride = stringArgument(annotation(checker, declaration, 'path') ?? annotation(checker, declaration, 'route'));
            const classRoles = roles(checker, declaration);
            if (isCommand) {
                const fields = fieldsFor(declaration, checker, resolver, diagnostics, hasMetadata);
                const chain = classChain(declaration, checker);
                concepts.set(key, chain.flatMap(owner => owner.members.filter(ts.isPropertyDeclaration)).flatMap(member => {
                    const symbol = checker.getTypeAtLocation(member).getSymbol();
                    return symbol && member.name && ts.isIdentifier(member.name) ? [{ name: member.name.text, symbol }] : [];
                }));
                const handle = [...chain].reverse().flatMap(owner => owner.members).find(member =>
                    ts.isMethodDeclaration(member) && member.name.getText() === 'handle');
                if (!handle || !ts.isMethodDeclaration(handle)) throw new Error(`${path}: ${owner} requires handle()`);
                const result = checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(handle)!);
                const unwrapped = checker.getAwaitedType(result) ?? result;
                operations.push({ kind: 'command', name: owner, owner, namespace, routeOverride: pathOverride,
                    roles: classRoles, fields, result: resolver.resolve(unwrapped, handle) });
            }
            if (isModel) for (const member of declaration.members) {
                if (!ts.isMethodDeclaration(member) || !annotation(checker, member, 'query')) continue;
                const name = member.name.getText();
                if (!identifier.test(name)) throw new Error(`${path}: unsupported generated identifier ${name}`);
                const parameters: SourceField[] = [];
                const queryAnnotation = annotation(checker, member, 'query');
                const explicit = queryAnnotation && ts.isCallExpression(queryAnnotation) ? queryAnnotation.arguments : [];
                const argumentsModel = explicit[0] && ts.isObjectLiteralExpression(explicit[0]) ? explicit[0].properties.find(property =>
                    ts.isPropertyAssignment(property) && property.name.getText() === 'argumentsModel') : undefined;
                const modelNode = argumentsModel && ts.isPropertyAssignment(argumentsModel) ? argumentsModel.initializer : undefined;
                const modelSymbol = modelNode && originalSymbol(checker, modelNode);
                const queryKey = [namespace, owner, name].filter(Boolean).join('.');
                if (modelSymbol) targets.set(queryKey, modelSymbol);
                for (const parameter of member.parameters) {
                    const parameterName = parameter.name.getText();
                    if (!identifier.test(parameterName)) throw new Error(`${path}: unsupported generated identifier ${parameterName}`);
                    const binding = explicit.find(item => ts.isCallExpression(item) && isPackageSymbol(checker, item.expression, 'argument', '@cratis/arc.core') &&
                        item.arguments[0] && ts.isStringLiteral(item.arguments[0]) && item.arguments[0].text === parameterName);
                    if (!binding) {
                        const serviceBinding = explicit.some(item => ts.isCallExpression(item) && isPackageSymbol(checker, item.expression, 'service', '@cratis/arc.core') &&
                            item.arguments[0] && originalSymbol(checker, item.arguments[0]) === checker.getTypeAtLocation(parameter).symbol);
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
                        if (!serviceBinding && !(inferredService && (hasMetadata || program.getCompilerOptions().experimentalDecorators === true)))
                            throw new Error(`${path}:${file.getLineAndCharacterOfPosition(parameter.getStart()).line + 1}: unbound query parameter ${parameterName}`);
                        continue;
                    }
                    const option = binding && ts.isCallExpression(binding) ? binding.arguments[2] : undefined;
                    const optional = !!parameter.questionToken || !!parameter.initializer || !!option && ts.isObjectLiteralExpression(option) &&
                        option.properties.some(property => ts.isPropertyAssignment(property) && property.name.getText() === 'optional' && property.initializer.kind === ts.SyntaxKind.TrueKeyword);
                    parameters.push({ name: parameterName, type: resolver.resolve(checker.getTypeAtLocation(parameter), parameter, optional), optional });
                }
                concepts.set(queryKey, member.parameters.filter(parameter => parameters.some(field => field.name === parameter.name.getText())).flatMap(parameter => {
                    const symbol = checker.getTypeAtLocation(parameter).getSymbol();
                    return symbol && ts.isIdentifier(parameter.name) ? [{ name: parameter.name.text, symbol }] : [];
                }));
                const signature = checker.getSignatureFromDeclaration(member);
                if (!signature) throw new Error(`${path}: missing query signature ${name}`);
                const result = queryResult(checker.getReturnTypeOfSignature(signature), checker, member);
                const options = explicit[0];
                const declaredObservable = options && ts.isObjectLiteralExpression(options) && options.properties.some(property =>
                    ts.isPropertyAssignment(property) && property.name.getText() === 'observable' && property.initializer.kind === ts.SyntaxKind.TrueKeyword);
                if (result.observable !== !!declaredObservable && (!hasMetadata || !!declaredObservable))
                    throw new Error(`${path}: ${owner}.${name} observable return must match @query({ observable: true })`);
                const element = resolver.resolve(result.type, member);
                if (result.paged && (element.enumerable || element.void || element.nullable))
                    throw new Error(`${path}:${file.getLineAndCharacterOfPosition(member.getStart()).line + 1}: Unsupported paged query element`);
                const response: SourceType = result.paged ? { ...element, text: `${element.text}[]`, enumerable: true } : element;
                operations.push({ kind: result.observable ? 'observable' : 'query', name, owner, namespace,
                    routeOverride: stringArgument(annotation(checker, member, 'path') ?? annotation(checker, member, 'route')) ?? pathOverride,
                    roles: annotation(checker, member, 'allowAnonymous') || annotation(checker, member, 'authorize') || annotation(checker, member, 'roles') ?
                        roles(checker, member) : classRoles, fields: parameters, result: response });
            }
        }
    }
    if (!operations.length) throw new Error(`No @command or @readModel queries below ${root} in ${project}`);
    const recordedRules = new Map<string, readonly RecordedRule[]>();
    for (const [key, target] of targets) {
        const direct = validators.filter(item => item.target === target);
        const inherited = (concepts.get(key) ?? []).flatMap(field => validators.filter(item => item.target === field.symbol).flatMap(item =>
            item.rules.filter(rule => rule.path.length === 1 && rule.path[0] === 'value').map(rule => ({ ...rule, path: [field.name] }))));
        const rules = [...direct.flatMap(item => item.rules), ...inherited];
        const fields = operations.find(operation => [operation.namespace, operation.owner, ...(operation.kind === 'command' ? [] : [operation.name])].filter(Boolean).join('.') === key)?.fields ?? [];
        for (const rule of rules) if (rule.clientSafe && (rule.path.length !== 1 || !fields.some(field => field.name === rule.path[0])))
            diagnostics.push(`Server-only validation rule on ${key}.${rule.path.join('.')}: path is not a @field or bound argument`);
        const valid = rules.filter(rule => rule.clientSafe && rule.path.length === 1 && fields.some(field => field.name === rule.path[0]));
        if (valid.length) recordedRules.set(key, valid);
    }
    // Source-only predicates and conditional rules cannot be represented by the browser validator.
    for (const validator of validators) diagnostics.push(...validator.diagnostics);
    return { operations, models: [...resolver.models.values()], recordedRules, diagnostics: [...new Set(diagnostics)] };
}
