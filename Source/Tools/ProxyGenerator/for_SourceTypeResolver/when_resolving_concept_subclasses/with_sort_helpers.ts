// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { ClientOperationKind } from '@cratis/arc.core';
import ts from 'typescript';
import { SourceTypeResolver } from '../../SourceTypeResolver.js';
import { renderSource } from '../../renderSource.js';
import type { SourceOperation } from '../../SourceOperation.js';

describe('when resolving concept subclasses with sort helpers', () => {
    let output: ReadonlyMap<string, string>;
    beforeEach(() => {
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
        output = renderSource({ models: [...resolver.models.values()], operations: [query,
            { ...query, kind: ClientOperationKind.Command, name: 'Register', result }] });
    });
    it('should retain the generated concept classes', () => {
        output.get('DerivedName.ts')!.should.contain('export class DerivedName {');
        output.get('GenericIntermediate.ts')!.should.contain('export class GenericIntermediate {');
        output.get('GenericName.ts')!.should.contain('export class GenericName extends GenericIntermediate {');
    });
    it('should retain model field types and constructors', () => {
        output.get('ScalarFields.ts')!.should.contain('@field(DerivedName)\n    derivedName!: DerivedName;');
        output.get('ScalarFields.ts')!.should.contain('@field(GenericName)\n    genericName!: GenericName;');
    });
    it('should retain command and query parameter types', () => {
        output.get('Register.ts')!.should.contain('derivedName?: DerivedName;');
        output.get('Register.ts')!.should.contain('genericName?: GenericName;');
        output.get('All.ts')!.should.contain('derivedName: DerivedName;');
        output.get('All.ts')!.should.contain('genericName: GenericName;');
    });
    it('should classify inherited scalar concepts only for sort helpers', () => {
        const query = output.get('All.ts')!;
        query.should.contain("readonly derivedName = new SortingActions('derivedName')");
        query.should.contain("readonly genericName = new SortingActions('genericName')");
        query.should.not.contain('@deprecated');
    });
});
