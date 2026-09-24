// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { dirname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { SourceTypeResolver } from './SourceTypeResolver.js';
import type { SourceAnalysis } from './SourceAnalysis.js';
import type { SourceField } from './SourceField.js';
import type { SourceOperation } from './SourceOperation.js';
import type { SourceType } from './SourceType.js';
import { extractValidatorRules, type ValidatorRules } from './extractValidatorRules.js';
import type { RecordedRule } from './RecordedRule.js';

function annotation(checker: ts.TypeChecker, node: ts.Node, name: string, owner: 'arc' | 'fundamentals' = 'arc'): ts.CallExpression | ts.Identifier | undefined {
    for (const decorator of ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : []) {
        const expression = decorator.expression;
        const identifier = ts.isCallExpression(expression) ? expression.expression : expression;
        if (!ts.isIdentifier(identifier)) continue;
        const symbol = checker.getSymbolAtLocation(identifier);
        const original = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
        const declarations = original?.declarations ?? [];
        if (original?.name === name && declarations.some(declaration => declaration.getSourceFile().fileName.includes(owner === 'arc' ? 'Arc.Core' : 'fundamentals')))
            return expression as ts.CallExpression | ts.Identifier;
    }
    return undefined;
}
function stringArgument(value: ts.CallExpression | ts.Identifier | undefined, key?: string): string | undefined {
    if (!value || !ts.isCallExpression(value)) return undefined;
    const selected = key && value.arguments[0] && ts.isObjectLiteralExpression(value.arguments[0]) ? value.arguments[0].properties.find(property =>
        ts.isPropertyAssignment(property) && property.name.getText() === key) : value.arguments[0];
    const argument = selected && ts.isPropertyAssignment(selected) ? selected.initializer : selected;
    return argument && ts.isStringLiteral(argument) ? argument.text : undefined;
}
function roles(checker: ts.TypeChecker, node: ts.Node): string[] {
    const decorator = annotation(checker, node, 'roles');
    if (!decorator || !ts.isCallExpression(decorator)) return [];
    return decorator.arguments.map(argument => {
        if (!ts.isStringLiteral(argument)) throw new Error(`${argument.getSourceFile().fileName}: roles must be string literals`);
        return argument.text;
    });
}
function queryResult(type: ts.Type, checker: ts.TypeChecker, node: ts.Node): { type: ts.Type; observable: boolean; paged: boolean } {
    let current = type;
    if (current.symbol?.name === 'Promise') current = checker.getTypeArguments(current as ts.TypeReference)[0] ?? current;
    const name = current.aliasSymbol?.name ?? current.symbol?.name;
    if (name === 'ObservableSource' || name === 'Observable' || name === 'AsyncIterable' || name === 'AsyncGenerator')
        return { type: current.aliasTypeArguments?.[0] ?? checker.getTypeArguments(current as ts.TypeReference)[0] ?? current, observable: true, paged: false };
    if (name === 'QueryPage') return { type: checker.getTypeArguments(current as ts.TypeReference)[0] ?? current, observable: false, paged: true };
    if (name === 'Promise' || name === 'ObservableSource') throw new Error(`${node.getSourceFile().fileName}: missing query result type`);
    return { type: current, observable: false, paged: false };
}
export function analyzeSource(project: string, artifacts: string): SourceAnalysis {
    const configFile = ts.readConfigFile(project, ts.sys.readFile);
    if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
    const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(resolve(project)), undefined, resolve(project));
    if (config.errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(config.errors, {
        getCanonicalFileName: file => file, getCurrentDirectory: ts.sys.getCurrentDirectory, getNewLine: () => '\n'
    }));
    const program = ts.createProgram(config.fileNames, config.options);
    const checker = program.getTypeChecker();
    const root = resolve(artifacts);
    const resolver = new SourceTypeResolver(checker, root);
    const operations: SourceOperation[] = [];
    const validators: ValidatorRules[] = [];
    const targets = new Map<string, ts.Symbol>();
    const concepts = new Map<string, { name: string; symbol: ts.Symbol }[]>();
    for (const file of program.getSourceFiles()) {
        const path = resolve(file.fileName);
        if (file.isDeclarationFile || !(path === root || path.startsWith(root + sep)) || path.includes(`${sep}for_`)) continue;
        for (const declaration of file.statements) {
            if (!ts.isClassDeclaration(declaration) || !declaration.name) continue;
            const validator = annotation(checker, declaration, 'validator');
            if (validator && ts.isCallExpression(validator)) {
                const extracted = extractValidatorRules(declaration, checker, validator);
                if (extracted) validators.push(extracted);
            }
            if (annotation(checker, declaration, 'derivedType', 'fundamentals'))
                resolver.resolve(checker.getTypeAtLocation(declaration), declaration);
            const isCommand = !!annotation(checker, declaration, 'command');
            const isModel = !!annotation(checker, declaration, 'readModel');
            if (!isCommand && !isModel) continue;
            const namespace = stringArgument(annotation(checker, declaration, isCommand ? 'command' : 'readModel'), 'namespace') ??
                relative(root, dirname(path)).split(sep).filter(Boolean).join('.');
            const owner = declaration.name.text;
            const key = [namespace, owner].filter(Boolean).join('.');
            const classSymbol = checker.getSymbolAtLocation(declaration.name);
            if (isCommand && classSymbol) targets.set(key, classSymbol);
            const pathOverride = stringArgument(annotation(checker, declaration, 'path') ?? annotation(checker, declaration, 'route'));
            const classRoles = roles(checker, declaration);
            if (isCommand) {
                const fields: SourceField[] = declaration.members.filter(ts.isPropertyDeclaration).filter(member => !!annotation(checker, member, 'field', 'fundamentals'))
                    .map(member => ({ name: member.name.getText(), type: resolver.resolve(checker.getTypeAtLocation(member), member, !!member.questionToken), optional: !!member.questionToken }));
                concepts.set(key, declaration.members.filter(ts.isPropertyDeclaration).flatMap(member => {
                    const symbol = checker.getTypeAtLocation(member).getSymbol();
                    return symbol && member.name && ts.isIdentifier(member.name) ? [{ name: member.name.text, symbol }] : [];
                }));
                const handle = declaration.members.find(member => ts.isMethodDeclaration(member) && member.name.getText() === 'handle');
                if (!handle || !ts.isMethodDeclaration(handle)) throw new Error(`${path}: ${owner} requires handle()`);
                const result = checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(handle)!);
                const unwrapped = checker.getAwaitedType(result) ?? result;
                operations.push({ kind: 'command', name: owner, owner, namespace, routeOverride: pathOverride,
                    roles: classRoles, fields, result: resolver.resolve(unwrapped, handle) });
            }
            if (isModel) for (const member of declaration.members) {
                if (!ts.isMethodDeclaration(member) || !annotation(checker, member, 'query')) continue;
                const name = member.name.getText();
                const parameters: SourceField[] = [];
                const queryAnnotation = annotation(checker, member, 'query');
                const explicit = queryAnnotation && ts.isCallExpression(queryAnnotation) ? queryAnnotation.arguments : [];
                const argumentsModel = explicit[0] && ts.isObjectLiteralExpression(explicit[0]) ? explicit[0].properties.find(property =>
                    ts.isPropertyAssignment(property) && property.name.getText() === 'argumentsModel') : undefined;
                const modelNode = argumentsModel && ts.isPropertyAssignment(argumentsModel) ? argumentsModel.initializer : undefined;
                const importedModel = modelNode && checker.getSymbolAtLocation(modelNode);
                const modelSymbol = importedModel?.flags && importedModel.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(importedModel) : importedModel;
                const queryKey = [namespace, owner, name].filter(Boolean).join('.');
                if (modelSymbol) targets.set(queryKey, modelSymbol);
                for (const parameter of member.parameters) {
                    const parameterName = parameter.name.getText();
                    const binding = explicit.find(item => ts.isCallExpression(item) && item.expression.getText() === 'argument' &&
                        item.arguments[0] && ts.isStringLiteral(item.arguments[0]) && item.arguments[0].text === parameterName);
                    if (!binding) {
                        const serviceBinding = explicit.some(item => ts.isCallExpression(item) && item.expression.getText() === 'service' &&
                            item.arguments[0]?.getText() === checker.getTypeAtLocation(parameter).symbol?.name);
                        const legacyClassService = config.options.experimentalDecorators === true && !explicit.length &&
                            !!checker.getTypeAtLocation(parameter).symbol?.declarations?.some(ts.isClassDeclaration);
                        if (!serviceBinding && !legacyClassService)
                            throw new Error(`${path}:${file.getLineAndCharacterOfPosition(parameter.getStart()).line + 1}: unbound query parameter ${parameterName}`);
                        continue;
                    }
                    parameters.push({ name: parameterName, type: resolver.resolve(checker.getTypeAtLocation(parameter), parameter, !!parameter.questionToken),
                        optional: !!parameter.questionToken || !!parameter.initializer });
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
                if (result.observable !== !!declaredObservable) throw new Error(`${path}: ${owner}.${name} observable return must match @query({ observable: true })`);
                const element = resolver.resolve(result.type, member);
                if (result.paged && (element.enumerable || element.void || element.nullable))
                    throw new Error(`${path}:${file.getLineAndCharacterOfPosition(member.getStart()).line + 1}: Unsupported paged query element`);
                const response: SourceType = result.paged ? { ...element, text: `${element.text}[]`, enumerable: true } : element;
                operations.push({ kind: result.observable ? 'observable' : 'query', name, owner, namespace,
                    routeOverride: stringArgument(annotation(checker, member, 'path') ?? annotation(checker, member, 'route')) ?? pathOverride,
                    roles: roles(checker, member).length ? roles(checker, member) : classRoles, fields: parameters, result: response });
            }
        }
    }
    if (!operations.length) throw new Error(`No @command or @readModel queries below ${root} in ${project}`);
    const recordedRules = new Map<string, readonly RecordedRule[]>();
    const diagnostics: string[] = [];
    for (const [key, target] of targets) {
        const direct = validators.filter(item => item.target === target);
        const inherited = (concepts.get(key) ?? []).flatMap(field => validators.filter(item => item.target === field.symbol).flatMap(item =>
            item.rules.filter(rule => rule.path.length === 1 && rule.path[0] === 'value').map(rule => ({ ...rule, path: [field.name] }))));
        const rules = [...direct.flatMap(item => item.rules), ...inherited];
        if (rules.length) recordedRules.set(key, rules);
    }
    // Source-only predicates and conditional rules cannot be represented by the browser validator.
    for (const validator of validators) diagnostics.push(...validator.diagnostics);
    return { operations, models: [...resolver.models.values()], recordedRules, diagnostics: [...new Set(diagnostics)] };
}
