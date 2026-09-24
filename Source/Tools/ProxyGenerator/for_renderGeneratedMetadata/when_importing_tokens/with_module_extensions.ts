// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { given } from '../../given.js';
import { MetadataImports } from '../../MetadataImports.js';
import { sourceProgram } from '../../sourceProgram.js';
import { a_markers_project } from '../given/a_markers_project.js';

describe('when importing runtime tokens from typed modules', given(a_markers_project, context => {
    let imports: string;
    beforeEach(() => {
        const program = sourceProgram(context.project);
        const checker = program.getTypeChecker();
        const collector = new MetadataImports(checker, context.output);
        for (const name of ['ModuleToken.mts', 'LegacyToken.cts', 'DeclarationToken.d.ts']) {
            const file = program.getSourceFiles().find(source => source.fileName.endsWith(name))!;
            const declaration = file.statements.find(ts.isClassDeclaration)!;
            collector.symbol(checker.getSymbolAtLocation(declaration.name!)!, declaration, declaration);
        }
        imports = collector.render();
    });
    it('should use the matching ESM and CommonJS JavaScript extensions', () => {
        imports.should.contain('ModuleToken.mjs');
        imports.should.contain('LegacyToken.cjs');
    });
    it('should remove the declaration-only suffix', () => {
        imports.should.contain('DeclarationToken.js');
        imports.should.not.contain('.d.js');
    });
}));
