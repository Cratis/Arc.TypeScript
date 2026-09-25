// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { relative, sep } from 'node:path';
import ts from 'typescript';
import { originalSymbol } from './sourceSymbols.js';
import type { SourceTypeResolver } from './SourceTypeResolver.js';

/** Include locally declared identity details model types in generated clients. */
export function resolveIdentityDetails(declaration: ts.ClassDeclaration, checker: ts.TypeChecker, resolver: SourceTypeResolver,
    root: string, path: string, diagnostics: string[]): void {
    const resolveIdentity = (type: ts.Type, location: ts.Node): void => {
        const model = type.symbol?.declarations?.find(ts.isClassDeclaration);
        if (!model) return;
        const file = model.getSourceFile();
        if (file.isDeclarationFile || relative(root, file.fileName).split(sep).includes('..')) {
            diagnostics.push(`${path}: identity details model ${file.fileName} is outside the artifacts root or declaration-only; skipped`);
            return;
        }
        resolver.resolve(type, location);
    };
    const details = declaration.members.find(member => ts.isPropertyDeclaration(member) && member.name.getText() === 'detailsType');
    if (details && ts.isPropertyDeclaration(details) && details.initializer) {
        const symbol = originalSymbol(checker, details.initializer);
        const model = symbol?.declarations?.find(ts.isClassDeclaration);
        if (model) resolveIdentity(checker.getTypeAtLocation(model), model);
    }
    const provide = declaration.members.find(member => ts.isMethodDeclaration(member) && member.name.getText() === 'provide');
    if (provide && ts.isMethodDeclaration(provide)) {
        const signature = checker.getSignatureFromDeclaration(provide);
        if (signature) {
            const result = checker.getReturnTypeOfSignature(signature);
            const unwrapped = checker.getAwaitedType(result) ?? result;
            const candidate = unwrapped.isUnion() ?
                unwrapped.types.find(type => type.symbol?.declarations?.some(ts.isClassDeclaration)) : unwrapped;
            if (candidate?.symbol?.declarations?.some(ts.isClassDeclaration)) resolveIdentity(candidate, provide);
        }
    }
}
