// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderConceptSubclasses } from './given/concept_subclasses.js';

describe('when resolving concept subclasses and they are fields', () => {
    let model: string;
    beforeEach(() => { model = renderConceptSubclasses().get('ScalarFields.ts')!; });
    it('should type an indirect concept as its underlying scalar', () => model.should.contain('@field(String)\n    derivedName!: string;'));
    it('should type a generic concept as its underlying scalar', () => model.should.contain('@field(String)\n    genericName!: string;'));
    it('should not import the former concept classes', () => model.should.not.match(/import \{ (DerivedName|GenericName) \}/));
});
