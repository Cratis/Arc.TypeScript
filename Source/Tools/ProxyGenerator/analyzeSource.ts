// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { dirname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { SourceTypeResolver } from './SourceTypeResolver.js';
import type { SourceAnalysis } from './SourceAnalysis.js';
import type { SourceField } from './SourceField.js';
import type { SourceOperation } from './SourceOperation.js';
import type { SourceType } from './SourceType.js';

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
function queryResult(type: ts.Type, checker: ts.TypeChecker, node: ts.Node): { type: ts.Type; observable: boolean } {
    let current = type;
    if (current.symbol?.name === 'Promise') current = checker.getTypeArguments(current as ts.TypeReference)[0] ?? current;
    const name = current.aliasSymbol?.name ?? current.symbol?.name;
    if (name === 'ObservableSource' || name === 'Observable' || name === 'AsyncIterable' || name === 'AsyncGenerator')
        return { type: current.aliasTypeArguments?.[0] ?? checker.getTypeArguments(current as ts.TypeReference)[0] ?? current, observable: true };
    if (name === 'QueryPage') return { type: checker.getTypeArguments(current as ts.TypeReference)[0] ?? current, observable: false };
    if (name === 'Promise' || name === 'ObservableSource') throw new Error(`${node.getSourceFile().fileName}: missing query result type`);
    return { type: current, observable: false };
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
    for (const file of program.getSourceFiles()) {
        const path = resolve(file.fileName);
        if (file.isDeclarationFile || !(path === root || path.startsWith(root + sep)) || path.includes(`${sep}for_`)) continue;
        for (const declaration of file.statements) {
            if (!ts.isClassDeclaration(declaration) || !declaration.name) continue;
            const isCommand = !!annotation(checker, declaration, 'command');
            const isModel = !!annotation(checker, declaration, 'readModel');
            if (!isCommand && !isModel) continue;
            const namespace = stringArgument(annotation(checker, declaration, isCommand ? 'command' : 'readModel'), 'namespace') ??
                relative(root, dirname(path)).split(sep).filter(Boolean).join('.');
            const owner = declaration.name.text;
            const pathOverride = stringArgument(annotation(checker, declaration, 'path') ?? annotation(checker, declaration, 'route'));
            const classRoles = roles(checker, declaration);
            if (isCommand) {
                const fields: SourceField[] = declaration.members.filter(ts.isPropertyDeclaration).filter(member => !!annotation(checker, member, 'field', 'fundamentals'))
                    .map(member => ({ name: member.name.getText(), type: resolver.resolve(checker.getTypeAtLocation(member), member, !!member.questionToken), optional: !!member.questionToken }));
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
                if (explicit[0] && ts.isObjectLiteralExpression(explicit[0]) && explicit[0].properties.some(property =>
                    ts.isPropertyAssignment(property) && property.name.getText() === 'argumentsModel'))
                    throw new Error(`${path}:${file.getLineAndCharacterOfPosition(member.getStart()).line + 1}: query argumentsModel generation is not supported yet`);
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
                const signature = checker.getSignatureFromDeclaration(member);
                if (!signature) throw new Error(`${path}: missing query signature ${name}`);
                const result = queryResult(checker.getReturnTypeOfSignature(signature), checker, member);
                const options = explicit[0];
                const declaredObservable = options && ts.isObjectLiteralExpression(options) && options.properties.some(property =>
                    ts.isPropertyAssignment(property) && property.name.getText() === 'observable' && property.initializer.kind === ts.SyntaxKind.TrueKeyword);
                if (result.observable !== !!declaredObservable) throw new Error(`${path}: ${owner}.${name} observable return must match @query({ observable: true })`);
                const response: SourceType = resolver.resolve(result.type, member);
                operations.push({ kind: result.observable ? 'observable' : 'query', name, owner, namespace,
                    routeOverride: stringArgument(annotation(checker, member, 'path') ?? annotation(checker, member, 'route')) ?? pathOverride,
                    roles: roles(checker, member).length ? roles(checker, member) : classRoles, fields: parameters, result: response });
            }
        }
    }
    if (!operations.length) throw new Error(`No @command or @readModel queries below ${root} in ${project}`);
    return { operations, models: [...resolver.models.values()] };
}
