// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, field } from '@cratis/fundamentals';
import { encodeWireValue } from '../../../index.js';

class Name extends ConceptAs<string> { static readonly valueType = String; }
class Registration { @field(Name) name!: Name; }

describe('when encoding a public wire value with a concept', () => {
    let value: unknown;
    beforeEach(() => {
        const registration = new Registration();
        registration.name = new Name('Ada');
        value = encodeWireValue(registration);
    });
    it('should emit a JSON-ready plain object without stringifying it', () => {
        (value as { name: string }).should.deep.equal({ name: 'Ada' });
    });
});
