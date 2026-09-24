// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { SourceTypeResolver } from '../../SourceTypeResolver.js';
import { renderSource } from '../../renderSource.js';

describe('when resolving a derived model with a declared base', () => {
    it('should emit both classes and leave inherited fields on the base', () => {
        const root = resolve(process.cwd(), 'Source/Tools/ProxyGenerator');
        const path = resolve(root, 'for_SourceTypeResolver/given/SpecialItem.ts');
        const program = ts.createProgram([path], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, experimentalDecorators: true });
        const checker = program.getTypeChecker();
        const declaration = program.getSourceFile(path)!.statements.find(ts.isClassDeclaration)!;
        const resolver = new SourceTypeResolver(checker, dirname(dirname(path)));
        resolver.resolve(checker.getTypeAtLocation(declaration), declaration);
        const models = [...resolver.models.values()];
        const derived = models.find(item => item.name === 'SpecialItem')!;
        derived.base!.should.equal('BaseItem');
        derived.derivedTypeId!.should.equal('special');
        derived.fields.map(item => item.name).should.deep.equal(['priority']);
        models.find(item => item.name === 'BaseItem')!.fields.map(item => item.name).should.deep.equal(['title']);
        const output = renderSource({ operations: [], models }, { useProxyFileSuffix: true });
        output.get('given/SpecialItem.proxy.ts')!.should.contain("@derivedType('special')\nexport class SpecialItem extends BaseItem");
        output.get('given/SpecialItem.proxy.ts')!.should.contain("from './BaseItem.proxy'");
    });
});
