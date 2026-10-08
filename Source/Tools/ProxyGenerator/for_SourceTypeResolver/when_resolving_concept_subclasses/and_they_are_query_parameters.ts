// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderConceptSubclasses } from './given/concept_subclasses.js';

describe('when resolving concept subclasses and they are query parameters', () => {
    let query: string;
    beforeEach(() => { query = renderConceptSubclasses().get('All.ts')!; });
    it('should type an indirect concept parameter as its underlying scalar', () => {
        query.should.contain('derivedName: string;');
        query.should.contain("new ParameterDescriptor('derivedName', String, false)");
    });
    it('should type a generic concept parameter as its underlying scalar', () => {
        query.should.contain('genericName: string;');
        query.should.contain("new ParameterDescriptor('genericName', String, false)");
    });
    it('should not reference the former concept classes', () => query.should.not.match(/DerivedName|GenericName/));
    it('should keep sort helpers for the inherited scalar concepts', () => {
        query.should.contain("readonly derivedName = new SortingActions('derivedName')");
        query.should.contain("readonly genericName = new SortingActions('genericName')");
        query.should.not.contain('@deprecated');
    });
});
