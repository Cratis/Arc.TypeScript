// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import ts from 'typescript';
import { SourceTypeResolver } from '../../../SourceTypeResolver.js';
import { renderSource } from '../../../renderSource.js';

const rendered = new Map<string, ReadonlyMap<string, string>>();

/** Render the model of a class whose fields use indirect, generic and chained concept subclasses over several value types. */
export function renderIndirectConceptFields(scalarConceptSubclasses: boolean, emitInterfaces = false): ReadonlyMap<string, string> {
    const key = `${scalarConceptSubclasses}/${emitInterfaces}`;
    if (!rendered.has(key)) {
        const root = resolve('Source/Tools/ProxyGenerator/for_SourceTypeResolver/when_resolving_concept_subclasses/given');
        const path = resolve(root, 'IndirectConcepts.ts');
        const program = ts.createProgram([path], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, experimentalDecorators: true });
        const checker = program.getTypeChecker();
        const declaration = program.getSourceFile(path)!.statements.find(statement =>
            ts.isClassDeclaration(statement) && statement.name?.text === 'IndirectConceptFields')!;
        // The nullable decorator is only honoured when the field metadata is inferred from the source.
        const resolver = new SourceTypeResolver(checker, root, false, '', () => {}, undefined, scalarConceptSubclasses);
        resolver.resolve(checker.getTypeAtLocation(declaration), declaration);
        rendered.set(key, renderSource({ models: [...resolver.models.values()], operations: [] }, { emitInterfaces }));
    }
    return rendered.get(key)!;
}
