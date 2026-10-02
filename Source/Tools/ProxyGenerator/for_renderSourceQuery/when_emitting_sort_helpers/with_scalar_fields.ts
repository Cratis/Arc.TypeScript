// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import ts from 'typescript';
import { SourceTypeResolver } from '../../SourceTypeResolver.js';
import { renderSourceQuery } from '../../renderSourceQuery.js';
import { a_query } from '../given/a_query.js';

describe('when emitting sort helpers with scalar fields', () => {
    let output: string;
    beforeEach(() => {
        const root = resolve('Source/Tools/ProxyGenerator/for_renderSourceQuery/given');
        const path = resolve(root, 'ScalarFields.ts');
        const program = ts.createProgram([path], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, experimentalDecorators: true });
        const checker = program.getTypeChecker();
        const declaration = program.getSourceFile(path)!.statements.find(statement => ts.isClassDeclaration(statement) && statement.name?.text === 'ScalarFields')!;
        const resolver = new SourceTypeResolver(checker, root);
        resolver.resolve(checker.getTypeAtLocation(declaration), declaration);
        output = renderSourceQuery(a_query, 'All.ts', new Map([['Listing', 'Listing.ts']]), '/api/all', resolver.models.get('ScalarFields'));
    });
    for (const name of ['name', 'amount', 'enabled', 'timestamp', 'identifier', 'day', 'time', 'duration', 'status', 'label',
        'conceptName', 'derivedName', 'genericName', 'conceptAmount', 'conceptEnabled', 'conceptTimestamp', 'conceptIdentifier', 'conceptDay', 'conceptTime', 'conceptDuration', 'conceptStatus']) {
        it(`should retain static and instance sorting for ${name}`, () => {
            output.should.contain(`readonly ${name} = new SortingActions('${name}')`);
            output.should.contain(`this.${name} = new SortingActionsForQuery<Listing[]>('${name}', query)`);
            output.should.not.contain('@deprecated');
        });
    }
});
