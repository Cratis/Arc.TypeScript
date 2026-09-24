// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import ts from 'typescript';

const packages = new Map<string, string | undefined>();
function declaringPackage(file: string): string | undefined {
    let directory = dirname(file);
    const visited: string[] = [];
    while (directory !== parse(directory).root) {
        if (packages.has(directory)) break;
        visited.push(directory);
        const manifest = join(directory, 'package.json');
        if (existsSync(manifest)) {
            const name = (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: unknown }).name;
            if (typeof name === 'string') {
                packages.set(directory, name);
                break;
            }
        }
        directory = dirname(directory);
    }
    const result = packages.get(directory);
    for (const path of visited) packages.set(path, result);
    return result;
}
export function originalSymbol(checker: ts.TypeChecker, node: ts.Node): ts.Symbol | undefined {
    const found = checker.getSymbolAtLocation(node);
    return found && found.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(found) : found;
}
/** Match the declaring symbol and package, never the spelling of an import or a path substring. */
export function isPackageSymbol(checker: ts.TypeChecker, node: ts.Node, name: string, packageName: string): boolean {
    const symbol = originalSymbol(checker, node);
    return symbol?.getName() === name && !!symbol.declarations?.some(declaration =>
        declaringPackage(declaration.getSourceFile().fileName) === packageName);
}
export function isTypeFrom(checker: ts.TypeChecker, type: ts.Type, name: string, packageName: string): boolean {
    const symbol = type.aliasSymbol ?? type.getSymbol();
    return symbol?.getName() === name && !!symbol.declarations?.some(declaration =>
        declaringPackage(declaration.getSourceFile().fileName) === packageName);
}
export function isStandardType(type: ts.Type, name: string): boolean {
    const symbol = type.aliasSymbol ?? type.getSymbol();
    return symbol?.getName() === name && !!symbol.declarations?.some(declaration =>
        declaration.getSourceFile().hasNoDefaultLib || /^(lib\..*\.d\.ts)$/.test(declaration.getSourceFile().fileName.split(/[\\/]/).at(-1) ?? '') &&
        dirname(declaration.getSourceFile().fileName) === dirname(ts.getDefaultLibFilePath({})));
}
export const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
export function fieldName(node: ts.PropertyName): string {
    if (!ts.isIdentifier(node) || !identifier.test(node.text))
        throw new Error(`${node.getSourceFile().fileName}: unsupported generated identifier ${node.getText()}`);
    return node.text;
}
