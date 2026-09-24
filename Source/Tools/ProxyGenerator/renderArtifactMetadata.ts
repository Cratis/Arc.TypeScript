// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { annotation } from './sourceAnnotations.js';
import { isPackageSymbol, originalSymbol } from './sourceSymbols.js';
import { MetadataImports } from './MetadataImports.js';
import { metadataParameter } from './metadataParameter.js';
import { metadataResult } from './metadataResult.js';
import { queryResult } from './queryResult.js';

const callArguments = (expression: ts.Expression | undefined): readonly ts.Expression[] =>
    expression && ts.isCallExpression(expression) ? expression.arguments : [];
const method = (member: ts.ClassElement, name: string): member is ts.MethodDeclaration =>
    ts.isMethodDeclaration(member) && member.name.getText() === name;

/** Render one class's generated fallback; explicit decorator bindings still take precedence. */
export function renderArtifactMetadata(declaration: ts.ClassDeclaration, checker: ts.TypeChecker, imports: MetadataImports): string | undefined {
    const isCommand = !!annotation(checker, declaration, 'command');
    const isModel = !!annotation(checker, declaration, 'readModel');
    const validator = declaration.heritageClauses?.flatMap(clause => clause.types).find(base =>
        ['CommandValidator', 'QueryValidator', 'ConceptValidator', 'ModelValidator'].some(name =>
            isPackageSymbol(checker, base.expression, name, '@cratis/arc.core')));
    if (!isCommand && !isModel && !validator) return undefined;
    const symbol = checker.getSymbolAtLocation(declaration.name!);
    if (!symbol) throw new Error(`${declaration.getSourceFile().fileName}: missing artifact symbol`);
    const type = imports.symbol(symbol, declaration, declaration);
    const fields = declaration.members.filter(ts.isPropertyDeclaration).filter(member => !!annotation(checker, member, 'field', 'fundamentals'));
    const fieldNames = fields.map(field => {
        const binding = callArguments(annotation(checker, field, 'field', 'fundamentals'))[0];
        if (!binding || !ts.isIdentifier(binding) && !ts.isPropertyAccessExpression(binding))
            throw new Error(`${field.getSourceFile().fileName}: @field requires a static type token for generated metadata`);
        return [field.name.getText(), originalSymbol(checker, binding)?.getName() ?? binding.getText()];
    });
    const fieldOptions = fields.map(field => {
        const name = field.name.getText();
        const propertyType = checker.getTypeAtLocation(field);
        const optional = !!field.questionToken || !!annotation(checker, field, 'optional') || !!annotation(checker, field, 'defaultValue');
        const nullable = !!annotation(checker, field, 'nullable') || propertyType.isUnion() &&
            propertyType.types.some(part => !!(part.flags & ts.TypeFlags.Null));
        const defaultValue = callArguments(annotation(checker, field, 'defaultValue'))[0];
        if (defaultValue && !ts.isStringLiteral(defaultValue) && !ts.isNumericLiteral(defaultValue) &&
            defaultValue.kind !== ts.SyntaxKind.TrueKeyword && defaultValue.kind !== ts.SyntaxKind.FalseKeyword &&
            defaultValue.kind !== ts.SyntaxKind.NullKeyword)
            throw new Error(`${field.getSourceFile().fileName}: generated default for ${name} must be a literal`);
        const member = propertyType.isUnion() ? propertyType.types.find(part => part.symbol?.declarations?.some(ts.isEnumMember)) : propertyType;
        const enumSymbol = propertyType.aliasSymbol ?? (member?.symbol?.declarations?.find(ts.isEnumMember)?.parent.name &&
            checker.getSymbolAtLocation(member.symbol.declarations.find(ts.isEnumMember)!.parent.name));
        const enumDeclaration = enumSymbol?.declarations?.find(ts.isEnumDeclaration);
        const values = enumDeclaration?.members.map(item => checker.getConstantValue(item));
        if (values?.some(value => value === undefined)) throw new Error(`${field.getSourceFile().fileName}: unsupported enum ${name}`);
        return `${JSON.stringify(name)}: { optional: ${optional}, nullable: ${nullable}${defaultValue ? `, defaultValue: ${defaultValue.getText()}` : ''}` +
            `${values ? `, values: ${JSON.stringify(values)}` : ''} }`;
    });
    const handle = declaration.members.find(member => method(member, 'handle')) as ts.MethodDeclaration | undefined;
    const provide = declaration.members.find(member => method(member, 'provide')) as ts.MethodDeclaration | undefined;
    const queries = declaration.members.filter(ts.isMethodDeclaration).filter(member => !!annotation(checker, member, 'query'));
    const arity = (member: ts.MethodDeclaration | undefined): number | null => member ?
        Math.max(0, member.parameters.findIndex(parameter => !!parameter.initializer || !!parameter.dotDotDotToken) < 0 ?
            member.parameters.length : member.parameters.findIndex(parameter => !!parameter.initializer || !!parameter.dotDotDotToken)) : null;
    const signature = JSON.stringify({ name: declaration.name!.text, fields: fieldNames, handle: arity(handle), provide: arity(provide),
        queries: queries.map(query => [query.name.getText(), arity(query)]).sort(([a], [b]) => String(a).localeCompare(String(b))) });
    const injected: string[] = [];
    if (handle && !callArguments(annotation(checker, handle, 'inject')).length) {
        const result = provide && checker.getSignatureFromDeclaration(provide);
        const provided = result ? checker.getAwaitedType(checker.getReturnTypeOfSignature(result)) ?? checker.getReturnTypeOfSignature(result) : undefined;
        const parameters = handle.parameters.filter((parameter, index) => !(index === 0 && provided &&
            checker.isTypeAssignableTo(provided, checker.getTypeAtLocation(parameter))));
        injected.push(`['handle', [${parameters.map(parameter => metadataParameter(parameter, checker, imports, 'handle', provided)).join(', ')}]]`);
    }
    if (provide && !callArguments(annotation(checker, provide, 'inject')).length)
        injected.push(`['provide', [${provide.parameters.map(parameter => metadataParameter(parameter, checker, imports, 'provide')).join(', ')}]]`);
    const queryEntries = queries.map(query => {
        const decorated = callArguments(annotation(checker, query, 'query'));
        const explicit = decorated.some(argument => ts.isCallExpression(argument));
        const signature = checker.getSignatureFromDeclaration(query);
        if (!signature) throw new Error(`${query.getSourceFile().fileName}: missing query signature`);
        const result = queryResult(checker.getReturnTypeOfSignature(signature), checker, query);
        const parameters = explicit ? 'undefined' : `[${query.parameters.map(parameter => metadataParameter(parameter, checker, imports, 'query')).join(', ')}]`;
        return `[${JSON.stringify(query.name.getText())}, { parameters: ${parameters}, generated: ${!explicit}, observable: ${result.observable}, ` +
            `result: ${metadataResult(result.type, checker, imports, query, result.paged)} }]`;
    });
    const target = validator?.typeArguments?.[0];
    const targetType = target && checker.getTypeFromTypeNode(target);
    const targetToken = targetType ? imports.classToken(targetType, target) : undefined;
    const handleSignature = handle && checker.getSignatureFromDeclaration(handle);
    const handleReturn = handleSignature && (checker.getAwaitedType(checker.getReturnTypeOfSignature(handleSignature)) ??
        checker.getReturnTypeOfSignature(handleSignature));
    return `{ type: ${type}, signature: ${JSON.stringify(signature)}, metadata: {` +
        `${isCommand ? ' command: true,' : ''}${isModel ? ' readModel: true,' : ''}` +
        `${handleReturn ? ` handleResult: ${metadataResult(handleReturn, checker, imports, handle!)},` : ''}` +
        `${injected.length ? ` generatedBindings: true, injected: new Map([${injected.join(', ')}]),` : ''}` +
        `${queryEntries.length ? ` queryMethods: new Map([${queryEntries.join(', ')}]),` : ''}` +
        `${fieldOptions.length ? ` fieldOptions: new Map(Object.entries({ ${fieldOptions.join(', ')} })),` : ''}` +
        `${targetToken ? ` validatorTarget: ${targetToken},` : ''} } }`;
}
