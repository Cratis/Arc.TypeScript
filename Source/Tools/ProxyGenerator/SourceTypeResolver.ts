// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { dirname, relative, sep } from 'node:path';
import type { SourceField } from './SourceField.js';
import type { SourceModel } from './SourceModel.js';
import type { SourceType } from './SourceType.js';
import { fieldName, isPackageSymbol, isStandardType, isTypeFrom, originalSymbol } from './sourceSymbols.js';

const fundamentals = new Set(['Guid', 'DateOnly', 'TimeOnly', 'TimeSpan']);
const primitive = (text: string, constructor: string): SourceType => ({ text, constructor, enumerable: false, nullable: false, void: false });
export class SourceTypeResolver {
    readonly models = new Map<string, SourceModel>();
    constructor(private readonly checker: ts.TypeChecker, private readonly artifacts: string) {}
    private namespace(declaration: ts.Declaration): string {
        const segments = relative(this.artifacts, dirname(declaration.getSourceFile().fileName)).split(sep).filter(Boolean);
        if (segments.includes('..')) throw new Error(`${declaration.getSourceFile().fileName}: reachable model is outside the artifacts root`);
        return segments.join('.');
    }
    resolve(type: ts.Type, location: ts.Node, optional = false): SourceType {
        const parts = type.isUnion() ? type.types : [type];
        const nullable = optional || parts.some(part => !!(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
        const defined = parts.filter(part => !(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));
        if (defined.length === 1 && defined[0] !== type) return { ...this.resolve(defined[0]!, location), nullable };
        if (defined.length > 1 && defined.every(part => !!(part.flags & ts.TypeFlags.BooleanLiteral)))
            return { ...primitive('boolean', 'Boolean'), nullable };
        const firstEnumMember = defined[0]?.symbol?.declarations?.find(ts.isEnumMember);
        const enumSymbol = type.aliasSymbol ?? (firstEnumMember && this.checker.getSymbolAtLocation(firstEnumMember.parent.name));
        if (enumSymbol?.declarations?.some(ts.isEnumDeclaration) && defined.every(part =>
            part.symbol?.declarations?.some(declaration => ts.isEnumMember(declaration) && declaration.parent === enumSymbol.declarations?.[0])))
            return this.resolveEnum(enumSymbol, type, location, nullable);
        if (defined.length > 1 && defined.every(part => !!(part.flags & ts.TypeFlags.StringLiteral)))
            return { ...primitive(defined.map(part => JSON.stringify((part as ts.StringLiteralType).value)).join(' | '), 'String'), nullable };
        if (type.flags & ts.TypeFlags.StringLike) return { ...primitive('string', 'String'), nullable };
        if (type.flags & ts.TypeFlags.NumberLike) return { ...primitive('number', 'Number'), nullable };
        if (type.flags & ts.TypeFlags.BooleanLike) return { ...primitive('boolean', 'Boolean'), nullable };
        if (type.flags & (ts.TypeFlags.Void | ts.TypeFlags.Undefined)) return { ...primitive('void', 'Object'), void: true, nullable };
        const symbol = type.aliasSymbol ?? type.getSymbol();
        const name = symbol?.getName();
        if (isStandardType(type, 'Promise') || isStandardType(type, 'PromiseLike')) {
            const argument = this.checker.getTypeArguments(type as ts.TypeReference)[0];
            if (argument) return this.resolve(argument, location, optional);
        }
        if (isStandardType(type, 'Date')) return { ...primitive('Date', 'Date'), nullable };
        if (name && fundamentals.has(name) && isTypeFrom(this.checker, type, name, '@cratis/fundamentals'))
            return { ...primitive(name, name), package: '@cratis/fundamentals', nullable };
        if (this.checker.isArrayType(type) || this.checker.isTupleType(type)) {
            if (this.checker.isTupleType(type)) return this.unsupported(type, location);
            const element = this.checker.getTypeArguments(type as ts.TypeReference)[0];
            if (!element) return this.unsupported(type, location);
            const resolved = this.resolve(element, location);
            if (resolved.enumerable || resolved.void || resolved.nullable) return this.unsupported(type, location);
            return { ...resolved, text: resolved.text.includes(' | ') ? `(${resolved.text})[]` : `${resolved.text}[]`, enumerable: true, nullable };
        }
        if (type.getBaseTypes()?.some(base => isTypeFrom(this.checker, base, 'ConceptAs', '@cratis/fundamentals')) ||
            isTypeFrom(this.checker, type, 'ConceptAs', '@cratis/fundamentals')) {
            const base = type.getBaseTypes()?.find(candidate => isTypeFrom(this.checker, candidate, 'ConceptAs', '@cratis/fundamentals'));
            const argument = this.checker.getTypeArguments(type as ts.TypeReference)[0] ??
                (base && this.checker.getTypeArguments(base as ts.TypeReference)[0]);
            if (argument) return this.resolve(argument, location, optional);
        }
        const declaration = symbol?.declarations?.find(ts.isClassDeclaration);
        if (symbol?.declarations?.some(ts.isEnumDeclaration)) return this.resolveEnum(symbol, type, location, nullable);
        if (declaration && name && !declaration.getSourceFile().isDeclarationFile) {
            const key = declaration.getSourceFile().fileName + ':' + name;
            if (!this.models.has(key)) {
                this.models.set(key, { kind: 'model', name, namespace: this.namespace(declaration), fields: [] });
                const fields: SourceField[] = declaration.members.filter(ts.isPropertyDeclaration).filter(member => {
                    const decorators = ts.canHaveDecorators(member) ? ts.getDecorators(member) ?? [] : [];
                    if (!decorators.some(decorator => {
                        const expression = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
                        return isPackageSymbol(this.checker, expression, 'field', '@cratis/fundamentals');
                    })) return false;
                    return true;
                }).map(member => {
                    const name = fieldName(member.name);
                    const decorated = (label: string): boolean => (ts.getDecorators(member) ?? []).some(decorator => {
                        const expression = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
                        return isPackageSymbol(this.checker, expression, label, '@cratis/arc.core');
                    });
                    const optional = decorated('optional') || decorated('defaultValue');
                    if (member.questionToken && !optional)
                        throw new Error(`${member.getSourceFile().fileName}: ${name} TypeScript ? disagrees with Arc field optionality; add @optional() or remove ?`);
                    const enumeration = (ts.getDecorators(member) ?? []).map(decorator => decorator.expression).find(expression =>
                        ts.isCallExpression(expression) && isPackageSymbol(this.checker, expression.expression, 'enumeration', '@cratis/arc.core'));
                    const argument = enumeration && ts.isCallExpression(enumeration) ? enumeration.arguments[0] : undefined;
                    const enumSymbol = argument && originalSymbol(this.checker, argument);
                    const type = enumSymbol?.declarations?.some(ts.isEnumDeclaration) ? this.checker.getDeclaredTypeOfSymbol(enumSymbol) : this.checker.getTypeAtLocation(member);
                    const nullable = decorated('nullable');
                    return { name, type: this.resolve(type, member, optional || nullable), optional, nullable };
                });
                const baseType = type.getBaseTypes()?.find(base => base.symbol?.declarations?.some(ts.isClassDeclaration) &&
                    !base.symbol.declarations.every(origin => origin.getSourceFile().isDeclarationFile));
                const base = baseType ? this.resolve(baseType, declaration) : undefined;
                const derived = (ts.getDecorators(declaration) ?? []).map(decorator => decorator.expression).find(expression => {
                    if (!ts.isCallExpression(expression)) return false;
                    const symbol = ts.isPropertyAccessExpression(expression.expression) ? expression.expression.name : expression.expression;
                    return isPackageSymbol(this.checker, symbol, 'derivedType', '@cratis/fundamentals');
                });
                const derivedTypeId = derived && ts.isCallExpression(derived) && derived.arguments[0] && ts.isStringLiteral(derived.arguments[0]) ? derived.arguments[0].text : undefined;
                this.models.set(key, { kind: 'model', name, namespace: this.namespace(declaration), fields, base: base?.model, derivedTypeId });
            }
            return { ...primitive(name, name), model: name, nullable };
        }
        return this.unsupported(type, location);
    }
    private resolveEnum(symbol: ts.Symbol, type: ts.Type, location: ts.Node, nullable: boolean): SourceType {
        const declaration = symbol.declarations?.find(ts.isEnumDeclaration);
        if (!declaration) return this.unsupported(type, location);
        const name = symbol.getName();
        const members = declaration.members.map(member => ({ name: fieldName(member.name), value: this.checker.getConstantValue(member) }));
        if (members.some(member => typeof member.value !== 'number' && typeof member.value !== 'string')) return this.unsupported(type, location);
        this.models.set(declaration.getSourceFile().fileName + ':' + name, {
            kind: 'enum', name, namespace: this.namespace(declaration), fields: [], members: members as { name: string; value: number | string }[]
        });
        return { ...primitive(name, typeof members[0]?.value === 'string' ? 'String' : 'Number'), model: name, nullable };
    }
    private unsupported(type: ts.Type, location: ts.Node): never {
        const position = location.getSourceFile().getLineAndCharacterOfPosition(location.getStart());
        throw new Error(`${location.getSourceFile().fileName}:${position.line + 1}:${position.character + 1}: Unsupported client type ${this.checker.typeToString(type)}`);
    }
}
