// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { dirname, relative, sep } from 'node:path';
import type { SourceField } from './SourceField.js';
import type { SourceModel } from './SourceModel.js';
import type { SourceType } from './SourceType.js';

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
        if (defined.length > 1 && defined.every(part => !!(part.flags & ts.TypeFlags.StringLiteral)))
            return { ...primitive(defined.map(part => JSON.stringify((part as ts.StringLiteralType).value)).join(' | '), 'String'), nullable };
        if (type.flags & ts.TypeFlags.StringLike) return { ...primitive('string', 'String'), nullable };
        if (type.flags & ts.TypeFlags.NumberLike) return { ...primitive('number', 'Number'), nullable };
        if (type.flags & ts.TypeFlags.BooleanLike) return { ...primitive('boolean', 'Boolean'), nullable };
        if (type.flags & (ts.TypeFlags.Void | ts.TypeFlags.Undefined)) return { ...primitive('void', 'Object'), void: true, nullable };
        const symbol = type.aliasSymbol ?? type.getSymbol();
        const name = symbol?.getName();
        if (name === 'Promise' || name === 'PromiseLike') {
            const argument = this.checker.getTypeArguments(type as ts.TypeReference)[0];
            if (argument) return this.resolve(argument, location, optional);
        }
        if (name === 'Date') return { ...primitive('Date', 'Date'), nullable };
        if (name && fundamentals.has(name)) return { ...primitive(name, name), package: '@cratis/fundamentals', nullable };
        if (this.checker.isArrayType(type) || this.checker.isTupleType(type)) {
            if (this.checker.isTupleType(type)) return this.unsupported(type, location);
            const element = this.checker.getTypeArguments(type as ts.TypeReference)[0];
            if (!element) return this.unsupported(type, location);
            const resolved = this.resolve(element, location);
            if (resolved.enumerable || resolved.void || resolved.nullable) return this.unsupported(type, location);
            return { ...resolved, text: resolved.text.includes(' | ') ? `(${resolved.text})[]` : `${resolved.text}[]`, enumerable: true, nullable };
        }
        if (type.getBaseTypes()?.some(base => base.symbol?.getName() === 'ConceptAs') || name === 'ConceptAs') {
            const base = type.getBaseTypes()?.find(candidate => candidate.symbol?.getName() === 'ConceptAs');
            const argument = this.checker.getTypeArguments(type as ts.TypeReference)[0] ??
                (base && this.checker.getTypeArguments(base as ts.TypeReference)[0]);
            if (argument) return this.resolve(argument, location, optional);
        }
        const declaration = symbol?.declarations?.find(ts.isClassDeclaration);
        const enumDeclaration = symbol?.declarations?.find(ts.isEnumDeclaration);
        if (enumDeclaration && name) {
            const members = enumDeclaration.members.map(member => ({ name: member.name.getText(), value: this.checker.getConstantValue(member) }));
            if (members.some(member => typeof member.value !== 'number' && typeof member.value !== 'string')) return this.unsupported(type, location);
            this.models.set(enumDeclaration.getSourceFile().fileName + ':' + name, {
                kind: 'enum', name, namespace: this.namespace(enumDeclaration), fields: [], members: members as { name: string; value: number | string }[]
            });
            return { ...primitive(name, typeof members[0]?.value === 'string' ? 'String' : 'Number'), model: name, nullable };
        }
        if (declaration && name && !declaration.getSourceFile().isDeclarationFile) {
            const key = declaration.getSourceFile().fileName + ':' + name;
            if (!this.models.has(key)) {
                this.models.set(key, { kind: 'model', name, namespace: this.namespace(declaration), fields: [] });
                const fields: SourceField[] = declaration.members.filter(ts.isPropertyDeclaration).filter(member => {
                    const decorators = ts.canHaveDecorators(member) ? ts.getDecorators(member) ?? [] : [];
                    if (!decorators.some(decorator => {
                        const expression = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
                        const found = this.checker.getSymbolAtLocation(expression);
                        const actual = found && found.flags & ts.SymbolFlags.Alias ? this.checker.getAliasedSymbol(found) : found;
                        return actual?.name === 'field' && actual.declarations?.some(origin => origin.getSourceFile().fileName.includes('fundamentals'));
                    })) return false;
                    return true;
                }).map(member => {
                    const fieldName = member.name.getText();
                    return { name: fieldName, type: this.resolve(this.checker.getTypeAtLocation(member), member, !!member.questionToken), optional: !!member.questionToken };
                });
                const baseType = type.getBaseTypes()?.find(base => base.symbol?.declarations?.some(ts.isClassDeclaration) &&
                    !base.symbol.declarations.every(origin => origin.getSourceFile().isDeclarationFile));
                const base = baseType ? this.resolve(baseType, declaration) : undefined;
                const derived = (ts.getDecorators(declaration) ?? []).map(decorator => decorator.expression).find(expression => {
                    if (!ts.isCallExpression(expression) || !ts.isIdentifier(expression.expression)) return false;
                    const symbol = this.checker.getSymbolAtLocation(expression.expression);
                    const original = symbol && symbol.flags & ts.SymbolFlags.Alias ? this.checker.getAliasedSymbol(symbol) : symbol;
                    return original?.name === 'derivedType' && original.declarations?.some(origin => origin.getSourceFile().fileName.includes('fundamentals'));
                });
                const derivedTypeId = derived && ts.isCallExpression(derived) && derived.arguments[0] && ts.isStringLiteral(derived.arguments[0]) ? derived.arguments[0].text : undefined;
                this.models.set(key, { kind: 'model', name, namespace: this.namespace(declaration), fields, base: base?.model, derivedTypeId });
            }
            return { ...primitive(name, name), model: name, nullable };
        }
        return this.unsupported(type, location);
    }
    private unsupported(type: ts.Type, location: ts.Node): never {
        const position = location.getSourceFile().getLineAndCharacterOfPosition(location.getStart());
        throw new Error(`${location.getSourceFile().fileName}:${position.line + 1}:${position.character + 1}: Unsupported client type ${this.checker.typeToString(type)}`);
    }
}
