// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import ts from 'typescript';
import { SourceTypeResolver } from '../../SourceTypeResolver.js';

const root = resolve('Source/Tools/ProxyGenerator/for_SourceTypeResolver/when_resolving_type_shapes/given');
const path = resolve(root, 'Shapes.ts');
const program = ts.createProgram([path], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, experimentalDecorators: true });
const checker = program.getTypeChecker();
const classes = program.getSourceFile(path)!.statements.filter(ts.isClassDeclaration);
const shapes = classes.find(declaration => declaration.name!.text === 'Shapes')!;

function property(name: string): ts.PropertyDeclaration {
    return shapes.members.filter(ts.isPropertyDeclaration).find(member => member.name.getText() === name)!;
}

function resolveProperty(name: string, optional = false) {
    const member = property(name);
    return new SourceTypeResolver(checker, root).resolve(checker.getTypeAtLocation(member), member, optional);
}

describe('when resolving source type shapes', () => {
    it('should preserve nullable primitive, boolean, and literal unions', () => {
        resolveProperty('text', true).should.include({ text: 'string', constructor: 'String', nullable: true });
        resolveProperty('flag').should.include({ text: 'boolean', constructor: 'Boolean', nullable: false });
        resolveProperty('choice').should.include({ text: '"first" | "second"', constructor: 'String' });
        resolveProperty('choices', true).should.include({ text: '("first" | "second")[]', enumerable: true, nullable: true });
    });
    it('should filter void union members and unwrap promise types', () => {
        resolveProperty('optionalVoid').text.should.equal('string');
        resolveProperty('promised', true).should.include({ text: 'string', nullable: true });
        resolveProperty('promiseLike').text.should.equal('number');
        resolveProperty('empty').void.should.equal(true);
        resolveProperty('date').constructor.should.equal('Date');
    });
    it('should preserve enum identities and members', () => {
        const resolver = new SourceTypeResolver(checker, root);
        for (const name of ['status', 'priority']) {
            const member = property(name);
            resolver.resolve(checker.getTypeAtLocation(member), member);
        }
        resolver.models.get('Status')!.members!.should.deep.equal([{ name: 'Open', value: 'open' }, { name: 'Closed', value: 'closed' }]);
        resolver.models.get('Priority')!.members!.should.deep.equal([{ name: 'Low', value: 0 }, { name: 'High', value: 1 }]);
    });
    for (const name of ['mixed', 'nested', 'nullableElements', 'voidElements', 'tuple', 'unknownValue']) {
        it(`should reject ${name} with its source location`, () => {
            const member = property(name);
            const position = member.getSourceFile().getLineAndCharacterOfPosition(member.getStart());
            (() => resolveProperty(name)).should.throw(`${path}:${position.line + 1}:${position.character + 1}: Unsupported client type ${checker.typeToString(checker.getTypeAtLocation(member))}`);
        });
    }
    it('should preserve null without optional field metadata', () => {
        resolveProperty('text').nullable.should.equal(true);
    });
    it('should infer generated field optionality and nullability without including undecorated fields', () => {
        const declaration = classes.find(item => item.name!.text === 'InferredFields')!;
        const resolver = new SourceTypeResolver(checker, root, true);
        resolver.resolve(checker.getTypeAtLocation(declaration), declaration);
        resolver.models.get('InferredFields')!.fields.map(({ name, optional, nullable }) => ({ name, optional, nullable })).should.deep.equal([
            { name: 'question', optional: true, nullable: false },
            { name: 'initialized', optional: true, nullable: false },
            { name: 'nullable', optional: false, nullable: true }
        ]);
    });
    it('should reject a question token without Arc metadata', () => {
        const declaration = classes.find(item => item.name!.text === 'InferredFields')!;
        (() => new SourceTypeResolver(checker, root).resolve(checker.getTypeAtLocation(declaration), declaration))
            .should.throw(`${path}: question TypeScript ? disagrees with Arc field optionality; add @optional() or remove ?`);
    });
    it('should register recursive models before resolving their fields', () => {
        const declaration = classes.find(item => item.name!.text === 'RecursiveModel')!;
        const resolver = new SourceTypeResolver(checker, root);
        resolver.resolve(checker.getTypeAtLocation(declaration), declaration);
        resolver.models.size.should.equal(1);
        resolver.models.get('RecursiveModel')!.fields[0]!.type.modelKey!.should.equal('RecursiveModel');
    });
});
