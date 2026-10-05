// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderConceptSubclasses } from './given/concept_subclasses.js';

describe('when resolving concept subclasses and they are command parameters', () => {
    let command: string;
    beforeEach(() => { command = renderConceptSubclasses().get('Register.ts')!; });
    it('should type an indirect concept parameter as its underlying scalar', () => {
        command.should.contain('derivedName?: string;');
        command.should.contain("new PropertyDescriptor('derivedName', String, false)");
    });
    it('should type a generic concept parameter as its underlying scalar', () => {
        command.should.contain('genericName?: string;');
        command.should.contain("new PropertyDescriptor('genericName', String, false)");
    });
    it('should not reference the former concept classes', () => command.should.not.match(/DerivedName|GenericName/));
});
