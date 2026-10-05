// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { ClientOperationKind } from '@cratis/arc.core';
import ts from 'typescript';
import { SourceTypeResolver } from '../../../SourceTypeResolver.js';
import { renderSource, type SourceRenderOptions } from '../../../renderSource.js';
import type { SourceOperation } from '../../../SourceOperation.js';

const rendered = new Map<boolean, ReadonlyMap<string, string>>();

/** Render a model, a command and a query using an indirect (DerivedName) and a generic (GenericName) concept subclass. */
export function renderConceptSubclasses(options: Pick<SourceRenderOptions, 'emitInterfaces'> = {}): ReadonlyMap<string, string> {
    // Building a compiler program takes seconds; the rendered output is immutable, so render each variant once.
    const emitInterfaces = !!options.emitInterfaces;
    if (!rendered.has(emitInterfaces)) rendered.set(emitInterfaces, render({ emitInterfaces }));
    return rendered.get(emitInterfaces)!;
}

function render(options: SourceRenderOptions): ReadonlyMap<string, string> {
    const root = resolve('Source/Tools/ProxyGenerator/for_renderSourceQuery/given');
    const path = resolve(root, 'ScalarFields.ts');
    const program = ts.createProgram([path], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, experimentalDecorators: true });
    const checker = program.getTypeChecker();
    const declaration = program.getSourceFile(path)!.statements.find(statement => ts.isClassDeclaration(statement) && statement.name?.text === 'ScalarFields')!;
    const resolver = new SourceTypeResolver(checker, root);
    const result = resolver.resolve(checker.getTypeAtLocation(declaration), declaration);
    const fields = resolver.models.get('ScalarFields')!.fields.filter(field => ['derivedName', 'genericName'].includes(field.name));
    const query: SourceOperation = { kind: ClientOperationKind.Query, name: 'All', owner: 'ScalarFields', namespace: '', roles: [],
        fields, result: { ...result, text: 'ScalarFields[]', enumerable: true } };
    return renderSource({ models: [...resolver.models.values()], operations: [query,
        { ...query, kind: ClientOperationKind.Command, name: 'Register', result }] }, options);
}
