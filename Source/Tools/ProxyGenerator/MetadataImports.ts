// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';
import { identifier, originalSymbol } from './sourceSymbols.js';

/** Stable, collision-free imports of runtime class tokens from their declaring modules. */
export class MetadataImports {
    readonly #imports = new Map<ts.Symbol, { module: string; name: string; alias: string }>();
    constructor(private readonly checker: ts.TypeChecker, private readonly output: string) {}
    classToken(type: ts.Type, node: ts.Node): string {
        const symbol = type.getSymbol();
        const declaration = symbol?.declarations?.find(ts.isClassDeclaration);
        if (!symbol || !declaration || !declaration.name || declaration.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AbstractKeyword))
            throw new Error(`${node.getSourceFile().fileName}:${node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1}: ` +
                `Cannot inject ${this.checker.typeToString(type)}: only concrete class tokens are injectable without an explicit token`);
        return this.symbol(symbol, declaration, node);
    }
    symbol(symbol: ts.Symbol, declaration: ts.Declaration, node: ts.Node): string {
        const existing = this.#imports.get(symbol);
        if (existing) return existing.alias;
        const name = symbol.getName();
        if (!identifier.test(name)) throw new Error(`${node.getSourceFile().fileName}: unsupported runtime token ${name}`);
        const source = declaration.getSourceFile().fileName;
        let module: string | undefined;
        const importDeclaration = node.getSourceFile().statements.filter(ts.isImportDeclaration).find(candidate =>
            candidate.importClause?.namedBindings && ts.isNamedImports(candidate.importClause.namedBindings) &&
            candidate.importClause.namedBindings.elements.some(element => originalSymbol(this.checker, element.name) === symbol));
        const importedModule = importDeclaration?.moduleSpecifier && ts.isStringLiteral(importDeclaration.moduleSpecifier) ?
            importDeclaration.moduleSpecifier.text : undefined;
        if (importedModule && !importedModule.startsWith('.')) module = importedModule;
        else if (!source.includes('/node_modules/')) {
            const path = relative(dirname(this.output), resolve(source)).replace(/\\/g, '/').replace(/\.(mts|cts|tsx?|jsx?)$/, '.js');
            module = path.startsWith('.') ? path : `./${path}`;
        }
        if (!module || !ts.isClassDeclaration(declaration) || !declaration.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
            throw new Error(`${source}: ${name} must be exported to generate a runtime token`);
        const alias = `_arc${this.#imports.size}`;
        this.#imports.set(symbol, { module, name, alias });
        return alias;
    }
    render(): string {
        return [...this.#imports.values()].map(({ module, name, alias }) =>
            `import { ${name} as ${alias} } from ${JSON.stringify(module)};`).join('\n');
    }
}
