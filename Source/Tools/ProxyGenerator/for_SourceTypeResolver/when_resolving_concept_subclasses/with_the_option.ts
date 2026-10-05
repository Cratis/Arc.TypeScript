// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderIndirectConceptFields } from './given/indirect_concept_fields.js';

describe('when resolving concept subclasses with the scalar option', () => {
    let model: string;
    beforeEach(() => { model = renderIndirectConceptFields(true).get('IndirectConceptFields.ts')!; });
    it('should type an indirect Guid concept as Guid', () => model.should.contain('@field(Guid)\n    id!: Guid;'));
    it('should type an indirect number concept as number', () => model.should.contain('@field(Number)\n    count!: number;'));
    it('should type an indirect Date concept as Date', () => model.should.contain('@field(Date)\n    moment!: Date;'));
    it('should type an indirect DateOnly concept as DateOnly', () => model.should.contain('@field(DateOnly)\n    day!: DateOnly;'));
    it('should import the Fundamentals types the fields use', () => model.should.contain("import { DateOnly, Guid, field } from '@cratis/fundamentals';"));
    it('should type a multi-level chain as the underlying value', () => model.should.contain('@field(String)\n    deepName!: string;'));
    it('should type generic concepts as their instantiated value', () => {
        model.should.contain('@field(String)\n    text!: string;');
        model.should.contain('@field(Number)\n    number!: number;');
    });
    it('should keep a nullable field nullable', () => model.should.contain('@field(Number)\n    maybeCount!: number | null;'));
    it('should type an array of concepts as an array of the underlying value', () => model.should.contain('@field(Guid, true)\n    ids!: Guid[];'));
    it('should keep a nullable array nullable', () => model.should.contain('@field(String, true)\n    maybeNames!: string[] | null;'));
    it('should not reference the concept classes from the model', () => model.should.not.match(/Derived(Id|Count|Moment|Day)|DeepName|TextWrapper/));
});
