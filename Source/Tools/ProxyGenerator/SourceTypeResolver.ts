// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { dirname, relative, sep } from 'node:path';
import type { SourceField } from './SourceField.js';
import type { SourceModel } from './SourceModel.js';
import type { SourceType } from './SourceType.js';
import { resolveTypeMappings, type ResolvedTypeMapping, type TypeMappings } from './typeMappings.js';
import { fieldName, isPackageSymbol, isStandardType, isTypeFrom, originalSymbol } from './sourceSymbols.js';
import { isScalarSortConcept } from './isScalarSortConcept.js';
import { conceptValue } from './conceptValue.js';

interface TypeResolution {
    readonly type: ts.Type;
    readonly location: ts.Node;
    readonly optional: boolean;
    readonly nullable: boolean;
    readonly defined: readonly ts.Type[];
}

interface ModelIdentity {
    readonly key: string;
    readonly name: string;
    readonly deprecated?: string;
}

const fundamentals = new Set(['Guid', 'DateOnly', 'TimeOnly', 'TimeSpan']);
const primitive = (text: string, constructor: string): SourceType => ({ text, constructor, enumerable: false, nullable: false, void: false });
export class SourceTypeResolver {
    readonly models = new Map<string, SourceModel>();
    private readonly declarations = new Map<string, ts.Declaration>();
    constructor(private readonly checker: ts.TypeChecker, private readonly artifacts: string,
        private readonly generatedMetadata = false, private readonly rootNamespace = '',
        private readonly contribute: (declaration: ts.Declaration) => void = () => {}, typeMappings?: TypeMappings,
        private readonly scalarConceptSubclasses = false) {
        this.mappings = resolveTypeMappings(typeMappings);
    }
    private readonly mappings: ReadonlyMap<string, ResolvedTypeMapping>;
    private readonly usedMappings = new Set<string>();
    /** Mappings that never matched a reachable type: almost always a misspelled key. */
    unusedMappings(): string[] { return [...this.mappings.keys()].filter(key => !this.usedMappings.has(key)); }
    /** An imported class is its own runtime constructor; an imported enum keeps the primitive constructor it would have had. */
    private mapped(key: string, enumConstructor?: 'String' | 'Number'): SourceType | undefined {
        const mapping = this.mappings.get(key);
        if (!mapping) return undefined;
        this.usedMappings.add(key);
        return { ...primitive(mapping.export, enumConstructor ?? mapping.export), package: mapping.package, mapped: true };
    }
    private namespace(declaration: ts.Declaration): string {
        const segments = relative(this.artifacts, dirname(declaration.getSourceFile().fileName)).split(sep).filter(Boolean);
        if (segments.includes('..')) throw new Error(`${declaration.getSourceFile().fileName}: reachable model is outside the artifacts root`);
        return [this.rootNamespace, ...segments].filter(Boolean).join('.');
    }
    resolve(type: ts.Type, location: ts.Node, optional = false): SourceType {
        const parts = type.isUnion() ? type.types : [type];
        const defined = parts.filter(part => !this.isAbsentPart(part, parts.length));
        const nullable = optional || defined.length !== parts.length;
        const context: TypeResolution = { type, location, optional, nullable, defined };
        return this.resolveUnion(context) ?? this.resolvePrimitive(context) ?? this.resolveBuiltIn(context)
            ?? this.resolveArray(context) ?? this.resolveConceptOrModel(context);
    }
    private isAbsentPart(part: ts.Type, count: number): boolean {
        return !!(part.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) || count > 1 && !!(part.flags & ts.TypeFlags.Void);
    }
    private resolveUnion(context: TypeResolution): SourceType | undefined {
        const { type, location, nullable, defined } = context;
        if (defined.length === 1 && defined[0] !== type) return { ...this.resolve(defined[0]!, location), nullable };
        if (this.isLiteralUnion(defined, ts.TypeFlags.BooleanLiteral)) return { ...primitive('boolean', 'Boolean'), nullable };
        const enumSymbol = this.unionEnum(type, defined);
        if (enumSymbol) return this.resolveEnum(enumSymbol, type, location, nullable);
        if (this.isLiteralUnion(defined, ts.TypeFlags.StringLiteral))
            return { ...primitive(defined.map(part => JSON.stringify((part as ts.StringLiteralType).value)).join(' | '), 'String'), nullable };
        return undefined;
    }
    private isLiteralUnion(defined: readonly ts.Type[], flag: ts.TypeFlags): boolean {
        return defined.length > 1 && defined.every(part => !!(part.flags & flag));
    }
    private unionEnum(type: ts.Type, defined: readonly ts.Type[]): ts.Symbol | undefined {
        const symbol = type.aliasSymbol ?? this.firstEnumSymbol(defined);
        if (!this.isEnumSymbol(symbol)) return undefined;
        return defined.every(part => this.isEnumPart(part, symbol!)) ? symbol : undefined;
    }
    private firstEnumSymbol(defined: readonly ts.Type[]): ts.Symbol | undefined {
        const member = defined[0]?.symbol?.declarations?.find(ts.isEnumMember);
        return member && this.checker.getSymbolAtLocation(member.parent.name);
    }
    private isEnumSymbol(symbol: ts.Symbol | undefined): boolean {
        return !!symbol?.declarations?.some(ts.isEnumDeclaration);
    }
    private isEnumPart(part: ts.Type, symbol: ts.Symbol): boolean | undefined {
        return part.symbol?.declarations?.some(declaration => ts.isEnumMember(declaration) && declaration.parent === symbol.declarations?.[0]);
    }
    private resolvePrimitive({ type, nullable }: TypeResolution): SourceType | undefined {
        if (type.flags & ts.TypeFlags.StringLike) return { ...primitive('string', 'String'), nullable };
        if (type.flags & ts.TypeFlags.NumberLike) return { ...primitive('number', 'Number'), nullable };
        if (type.flags & ts.TypeFlags.BooleanLike) return { ...primitive('boolean', 'Boolean'), nullable };
        if (type.flags & (ts.TypeFlags.Void | ts.TypeFlags.Undefined)) return { ...primitive('void', 'Object'), void: true, nullable };
        return undefined;
    }
    private resolveBuiltIn({ type, location, optional, nullable }: TypeResolution): SourceType | undefined {
        if (isStandardType(type, 'Promise') || isStandardType(type, 'PromiseLike')) {
            const argument = this.checker.getTypeArguments(type as ts.TypeReference)[0];
            if (argument) return this.resolve(argument, location, optional);
        }
        if (isStandardType(type, 'Date')) return { ...primitive('Date', 'Date'), nullable };
        const name = this.typeSymbol(type)?.getName();
        if (name && this.isFundamentalsType(type, name))
            return { ...primitive(name, name), package: '@cratis/fundamentals', nullable };
        return undefined;
    }
    private isFundamentalsType(type: ts.Type, name: string): boolean {
        return fundamentals.has(name) && isTypeFrom(this.checker, type, name, '@cratis/fundamentals');
    }
    private resolveArray({ type, location, nullable }: TypeResolution): SourceType | undefined {
        if (!this.checker.isArrayType(type) && !this.checker.isTupleType(type)) return undefined;
        if (this.checker.isTupleType(type)) return this.unsupported(type, location);
        const element = this.checker.getTypeArguments(type as ts.TypeReference)[0];
        if (!element) return this.unsupported(type, location);
        const resolved = this.resolve(element, location);
        if (!this.isArrayElement(resolved)) return this.unsupported(type, location);
        return { ...resolved, text: resolved.text.includes(' | ') ? `(${resolved.text})[]` : `${resolved.text}[]`, enumerable: true, nullable };
    }
    private isArrayElement(resolved: SourceType): boolean {
        return !resolved.enumerable && !resolved.void && !resolved.nullable;
    }
    private resolveConceptOrModel(context: TypeResolution): SourceType {
        const { type, location } = context;
        const direct = this.isDirectConcept(type);
        const resolved = direct ? this.resolveDirectConcept(context) : undefined;
        if (resolved) return resolved;
        const value = direct || !this.scalarConceptSubclasses ? undefined : conceptValue(this.checker, type, location);
        if (value) return this.resolveLegacyConcept(context, value);
        return this.resolveModelOrEnum(context);
    }
    private resolveDirectConcept({ type, location, optional }: TypeResolution): SourceType | undefined {
        const base = type.getBaseTypes()?.find(candidate => isTypeFrom(this.checker, candidate, 'ConceptAs', '@cratis/fundamentals'));
        const argument = this.checker.getTypeArguments(type as ts.TypeReference)[0] ??
            (base && this.checker.getTypeArguments(base as ts.TypeReference)[0]);
        if (!argument) return undefined;
        const declaration = this.classDeclaration(type);
        if (declaration) this.contribute(declaration);
        return this.resolve(argument, location, optional);
    }
    private resolveLegacyConcept({ type, location, optional, nullable }: TypeResolution, value: ts.Type): SourceType {
        // Indirect and generic concepts travel as their value. The class they used to produce is still generated, deprecated.
        const resolved = this.resolve(value, location, optional);
        const declaration = this.classDeclaration(type);
        const name = this.typeSymbol(type)?.getName();
        if (this.isLocalModel(declaration, name)) {
            const legacy = this.model(type, declaration!, name!, resolved.text);
            if (legacy.mapped) return { ...legacy, nullable };
        }
        return resolved;
    }
    private resolveModelOrEnum({ type, location, nullable }: TypeResolution): SourceType {
        const symbol = this.typeSymbol(type);
        if (this.isEnumSymbol(symbol)) return this.resolveEnum(symbol!, type, location, nullable);
        const declaration = this.classDeclaration(type);
        const name = symbol?.getName();
        if (this.isLocalModel(declaration, name)) return { ...this.model(type, declaration!, name!), nullable };
        return this.unsupported(type, location);
    }
    private typeSymbol(type: ts.Type): ts.Symbol | undefined {
        return type.aliasSymbol ?? type.getSymbol();
    }
    private classDeclaration(type: ts.Type): ts.ClassDeclaration | undefined {
        return this.typeSymbol(type)?.declarations?.find(ts.isClassDeclaration);
    }
    private isLocalModel(declaration: ts.ClassDeclaration | undefined, name: string | undefined): boolean {
        return !!declaration && !!name && !declaration.getSourceFile().isDeclarationFile;
    }
    private isDirectConcept(type: ts.Type): boolean {
        return isTypeFrom(this.checker, type, 'ConceptAs', '@cratis/fundamentals') ||
            !!type.getBaseTypes()?.some(base => isTypeFrom(this.checker, base, 'ConceptAs', '@cratis/fundamentals'));
    }
    /** A base that is itself an indirect concept keeps referencing its deprecated class, as it did before. */
    private resolveBase(type: ts.Type, location: ts.Node): SourceType {
        const symbol = this.typeSymbol(type);
        const declaration = this.classDeclaration(type);
        const value = this.isLegacyConceptBase(type, declaration) ? conceptValue(this.checker, type, location) : undefined;
        if (value) return this.model(type, declaration!, symbol!.getName(), this.resolve(value, location).text);
        return this.resolve(type, location);
    }
    private isLegacyConceptBase(type: ts.Type, declaration: ts.ClassDeclaration | undefined): boolean {
        return this.scalarConceptSubclasses && !!declaration && !declaration.getSourceFile().isDeclarationFile && !this.isDirectConcept(type);
    }
    /** Resolve a model class; `deprecated` is the underlying type text when the class stands for a concept subclass. */
    private model(type: ts.Type, declaration: ts.ClassDeclaration, name: string, deprecated?: string): SourceType {
        this.contribute(declaration);
        const key = [this.namespace(declaration), name].filter(Boolean).join('.');
        const mapped = this.mapped(key);
        if (mapped) return mapped;
        this.checkIdentity(key, declaration);
        const existing = this.models.get(key);
        // A class shared by instantiations with different values cannot name one underlying type.
        if (this.hasConflictingDeprecation(existing, deprecated)) this.models.set(key, { ...existing!, deprecated: {} });
        if (!existing) this.defineModel(type, declaration, { key, name, deprecated });
        return { ...primitive(name, name), model: name, modelKey: key };
    }
    private hasConflictingDeprecation(existing: SourceModel | undefined, deprecated: string | undefined): boolean {
        return !!existing?.deprecated && deprecated !== undefined && existing.deprecated.value !== deprecated;
    }
    private defineModel(type: ts.Type, declaration: ts.ClassDeclaration, { key, name, deprecated }: ModelIdentity): void {
        const deprecation = deprecated === undefined ? undefined : { value: declaration.typeParameters?.length ? undefined : deprecated };
        this.models.set(key, { kind: 'model', name, namespace: this.namespace(declaration), fields: [], ...(deprecation ? { deprecated: deprecation } : {}) });
        const fields = declaration.members.filter(ts.isPropertyDeclaration).filter(member => this.isField(member)).map(member => this.resolveField(member));
        const base = this.modelBase(type, declaration);
        const derivedTypeId = this.derivedTypeId(declaration);
        this.models.set(key, { kind: 'model', name, namespace: this.namespace(declaration), fields,
            ...base, derivedTypeId, ...(deprecation ? { deprecated: deprecation } : {}) });
    }
    private isDecorator(decorator: ts.Decorator, label: string, packageName: string): boolean {
        const expression = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
        return isPackageSymbol(this.checker, expression, label, packageName);
    }
    private isField(member: ts.PropertyDeclaration): boolean {
        const decorators = ts.canHaveDecorators(member) ? ts.getDecorators(member) ?? [] : [];
        return decorators.some(decorator => this.isDecorator(decorator, 'field', '@cratis/fundamentals'));
    }
    private hasArcDecorator(member: ts.PropertyDeclaration, label: string): boolean {
        return (ts.getDecorators(member) ?? []).some(decorator => this.isDecorator(decorator, label, '@cratis/arc.core'));
    }
    private isOptional(member: ts.PropertyDeclaration): boolean {
        return this.hasArcDecorator(member, 'optional') || this.hasArcDecorator(member, 'defaultValue') || this.hasGeneratedOptionality(member);
    }
    private hasGeneratedOptionality(member: ts.PropertyDeclaration): boolean {
        return this.generatedMetadata && (!!member.questionToken || !!member.initializer);
    }
    private hasGeneratedNullability(type: ts.Type): boolean {
        return this.generatedMetadata && type.isUnion() && type.types.some(part => !!(part.flags & ts.TypeFlags.Null));
    }
    private resolveField(member: ts.PropertyDeclaration): SourceField {
        const name = fieldName(member.name);
        const optional = this.isOptional(member);
        if (member.questionToken && !optional)
            throw new Error(`${member.getSourceFile().fileName}: ${name} TypeScript ? disagrees with Arc field optionality; add @optional() or remove ?`);
        const type = this.fieldType(member);
        const propertyType = this.checker.getTypeAtLocation(member);
        const nullable = this.hasArcDecorator(member, 'nullable') || this.hasGeneratedNullability(propertyType);
        return { name, type: this.resolve(type, member, optional || nullable), optional, nullable,
            ...(isScalarSortConcept(this.checker, type, member) ? { scalarSortConcept: true } : {}) };
    }
    private fieldType(member: ts.PropertyDeclaration): ts.Type {
        const enumeration = (ts.getDecorators(member) ?? []).map(decorator => decorator.expression).find(expression =>
            ts.isCallExpression(expression) && isPackageSymbol(this.checker, expression.expression, 'enumeration', '@cratis/arc.core'));
        const argument = enumeration && ts.isCallExpression(enumeration) ? enumeration.arguments[0] : undefined;
        const enumSymbol = argument && originalSymbol(this.checker, argument);
        return this.isEnumSymbol(enumSymbol) ? this.checker.getDeclaredTypeOfSymbol(enumSymbol!) : this.checker.getTypeAtLocation(member);
    }
    private modelBase(type: ts.Type, declaration: ts.ClassDeclaration): Pick<SourceModel, 'base' | 'baseKey' | 'basePackage'> {
        const baseType = type.getBaseTypes()?.find(base => this.isModelBase(base));
        const base = baseType ? this.resolveBase(baseType, declaration) : undefined;
        const basePackage = base?.mapped ? base.package : undefined;
        return { base: basePackage ? base!.text : base?.model, baseKey: base?.modelKey, basePackage };
    }
    private isModelBase(base: ts.BaseType): boolean | undefined {
        return base.symbol?.declarations?.some(ts.isClassDeclaration) &&
            !base.symbol.declarations.every(origin => origin.getSourceFile().isDeclarationFile);
    }
    private derivedTypeId(declaration: ts.ClassDeclaration): string | undefined {
        const derived = (ts.getDecorators(declaration) ?? []).map(decorator => decorator.expression).find(expression => {
            if (!ts.isCallExpression(expression)) return false;
            const symbol = ts.isPropertyAccessExpression(expression.expression) ? expression.expression.name : expression.expression;
            return isPackageSymbol(this.checker, symbol, 'derivedType', '@cratis/fundamentals');
        });
        if (!derived || !ts.isCallExpression(derived)) return undefined;
        const argument = derived.arguments[0];
        return argument && ts.isStringLiteral(argument) ? argument.text : undefined;
    }
    private resolveEnum(symbol: ts.Symbol, type: ts.Type, location: ts.Node, nullable: boolean): SourceType {
        const declaration = symbol.declarations?.find(ts.isEnumDeclaration);
        if (!declaration) return this.unsupported(type, location);
        this.contribute(declaration);
        const name = symbol.getName();
        const members = declaration.members.map(member => ({ name: fieldName(member.name), value: this.checker.getConstantValue(member) }));
        if (members.some(member => !this.isEnumValue(member.value))) return this.unsupported(type, location);
        const key = [this.namespace(declaration), name].filter(Boolean).join('.');
        const constructor = typeof members[0]?.value === 'string' ? 'String' : 'Number';
        const mapped = this.mapped(key, constructor);
        if (mapped) return { ...mapped, nullable };
        this.checkIdentity(key, declaration);
        this.models.set(key, {
            kind: 'enum', name, namespace: this.namespace(declaration), fields: [], members: members as { name: string; value: number | string }[]
        });
        return { ...primitive(name, constructor), model: name, modelKey: key, nullable };
    }
    private isEnumValue(value: string | number | undefined): boolean {
        return typeof value === 'number' || typeof value === 'string';
    }
    private checkIdentity(key: string, declaration: ts.Declaration): void {
        const previous = this.declarations.get(key);
        if (previous && previous !== declaration) throw new Error(`Ambiguous model name: ${key}`);
        this.declarations.set(key, declaration);
    }
    private unsupported(type: ts.Type, location: ts.Node): never {
        const position = location.getSourceFile().getLineAndCharacterOfPosition(location.getStart());
        throw new Error(`${location.getSourceFile().fileName}:${position.line + 1}:${position.character + 1}: Unsupported client type ${this.checker.typeToString(type)}`);
    }
}
