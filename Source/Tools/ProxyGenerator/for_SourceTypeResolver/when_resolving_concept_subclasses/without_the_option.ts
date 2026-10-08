// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderConceptSubclasses } from './given/concept_subclasses.js';
import { renderIndirectConceptFields } from './given/indirect_concept_fields.js';

describe('when resolving concept subclasses without the scalar option', () => {
    let model: string;
    let command: string;
    let query: string;
    let concepts: ReadonlyMap<string, string>;
    beforeEach(() => {
        const output = renderConceptSubclasses({ scalarConceptSubclasses: false });
        model = output.get('ScalarFields.ts')!;
        command = output.get('Register.ts')!;
        query = output.get('All.ts')!;
        concepts = renderIndirectConceptFields(false);
    });
    it('should keep the indirect concept as its model class', () => {
        model.should.contain("import { DerivedName } from './DerivedName';");
        model.should.contain('@field(DerivedName)\n    derivedName!: DerivedName;');
    });
    it('should keep the generic concept as its model class', () => model.should.contain('@field(GenericName)\n    genericName!: GenericName;'));
    it('should keep the concept classes as parameters', () => {
        command.should.contain('derivedName?: DerivedName;');
        query.should.contain('derivedName: DerivedName;');
    });
    it('should not deprecate the emitted classes', () => {
        concepts.get('DerivedId.ts')!.should.not.contain('@deprecated');
        concepts.get('DerivedId.ts')!.should.contain('export class DerivedId {\n}');
    });
    it('should keep the chain of classes', () => {
        concepts.get('DeepName.ts')!.should.contain('export class DeepName extends MiddleName {\n}');
        concepts.get('MiddleName.ts')!.should.contain('export class MiddleName {\n}');
    });
    it('should not emit classes for direct concepts', () => concepts.has('Id.ts').should.be.false);
});
