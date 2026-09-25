// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { dirname, relative, resolve, sep } from 'node:path';
import { discoveryFiles } from '@cratis/arc.core';
import { isPackageSymbol, originalSymbol } from './sourceSymbols.js';
import { annotation, classChain, fieldsFor, roles, stringArgument } from './sourceAnnotations.js';
import { commandResponseType } from './commandResponseType.js';
import ts from 'typescript';
import { SourceTypeResolver } from './SourceTypeResolver.js';
import type { SourceAnalysis } from './SourceAnalysis.js';
import type { SourceOperation } from './SourceOperation.js';
import { extractValidatorRules, type ValidatorRules } from './extractValidatorRules.js';
import { sourceProgram } from './sourceProgram.js';
import { warningOption } from './sourceOperationOptions.js';
import { resolveIdentityDetails } from './resolveIdentityDetails.js';
import { collectSourceQueries } from './collectSourceQueries.js';
import { collectSourceRules } from './collectSourceRules.js';

type Collection = {
    checker: ts.TypeChecker; program: ts.Program; root: string; rootNamespace: string; hasMetadata: boolean;
    resolver: SourceTypeResolver; diagnostics: string[]; operations: SourceOperation[]; validators: ValidatorRules[];
    targets: Map<string, ts.Symbol>; concepts: Map<string, { name: string; symbol: ts.Symbol }[]>;
};

function collectCommand(declaration: ts.ClassDeclaration, path: string, namespace: string, routeOverride: string | undefined,
    classRoles: ReturnType<typeof roles>, state: Collection): void {
    const { checker, resolver, hasMetadata, operations, concepts, targets, diagnostics } = state;
    const owner = declaration.name!.text;
    const key = [namespace, owner].filter(Boolean).join('.');
    const classSymbol = checker.getSymbolAtLocation(declaration.name!);
    if (classSymbol) targets.set(key, classSymbol);
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
    const response = commandResponseType(result, checker, handle);
    operations.push({ kind: 'command', name: owner, owner, namespace, routeOverride,
        treatWarningsAsErrors: warningOption(annotation(checker, declaration, 'command'), checker),
        roles: classRoles, fields,
        result: response ? resolver.resolve(response, handle) : resolver.resolve(checker.getVoidType(), handle) });
}

function collectDeclaration(declaration: ts.ClassDeclaration, path: string, state: Collection): void {
    const { checker, root, rootNamespace, hasMetadata, resolver, diagnostics, validators, operations, targets, concepts, program } = state;
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
    if (annotation(checker, declaration, 'identityDetailsProvider'))
        resolveIdentityDetails(declaration, checker, resolver, root, path, diagnostics);
    const isCommand = !!annotation(checker, declaration, 'command');
    const isModel = !!annotation(checker, declaration, 'readModel');
    if (!isCommand && !isModel) return;
    const namespace = stringArgument(annotation(checker, declaration, isCommand ? 'command' : 'readModel'), 'namespace') ??
        [rootNamespace, ...relative(root, dirname(path)).split(sep).filter(value => value && value !== '.')].filter(Boolean).join('.');
    const owner = declaration.name!.text;
    const pathOverride = stringArgument(annotation(checker, declaration, 'path') ?? annotation(checker, declaration, 'route'));
    const classRoles = roles(checker, declaration);
    if (isCommand) collectCommand(declaration, path, namespace, pathOverride, classRoles, state);
    if (isModel) collectSourceQueries(declaration, checker, program, resolver, path, namespace, owner, pathOverride,
        classRoles, hasMetadata, operations, targets, concepts);
}

function discoverClasses(state: Collection, visit?: (declaration: ts.ClassDeclaration) => void): void {
    const { checker, root, program } = state;
    for (const path of discoveryFiles(root).map(file => resolve(file))) {
        const file = program.getSourceFile(path);
        if (!file || file.isDeclarationFile) continue;
        const module = checker.getSymbolAtLocation(file);
        const exports = new Set(module ? checker.getExportsOfModule(module).map(symbol =>
            symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol) : []);
        for (const declaration of file.statements) {
            if (!ts.isClassDeclaration(declaration) || !declaration.name ||
                !exports.has(checker.getSymbolAtLocation(declaration.name)!)) continue;
            visit?.(declaration);
            collectDeclaration(declaration, path, state);
        }
    }
}

/** Analyze commands, queries, models, and client-safe validation rules beneath an artifacts root. */
export function analyzeSource(project: string, artifacts: string, rootNamespace = '', generatedMetadata = false,
    program = sourceProgram(project), visit?: (declaration: ts.ClassDeclaration) => void): SourceAnalysis {
    const checker = program.getTypeChecker();
    const root = resolve(artifacts);
    const state: Collection = {
        checker, program, root, rootNamespace, hasMetadata: generatedMetadata,
        resolver: new SourceTypeResolver(checker, root, generatedMetadata, rootNamespace),
        diagnostics: [], operations: [], validators: [], targets: new Map(), concepts: new Map()
    };
    discoverClasses(state, visit);
    if (!state.operations.length) throw new Error(`No @command or @readModel queries below ${root} in ${project}`);
    const recordedRules = collectSourceRules(state.targets, state.concepts, state.validators, state.operations, state.diagnostics);
    return { operations: state.operations, models: [...state.resolver.models.values()], recordedRules,
        diagnostics: [...new Set(state.diagnostics)] };
}
