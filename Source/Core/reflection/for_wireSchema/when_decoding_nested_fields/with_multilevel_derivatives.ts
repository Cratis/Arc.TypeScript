// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { derivedType, field } from '@cratis/fundamentals';
import { should } from 'vitest';
import { given } from '../../../given.js';
import { decode, encode, schemaFor } from '../../wireSchema.js';
should();

class Base { @field(String) title!: string; }
@derivedType('mid') class Mid extends Base { @field(String) note!: string | null; }
@derivedType('leaf') class Leaf extends Mid { @field(String) extra!: string; }
class Envelope { @field(Mid) item!: Mid; }
class a_multilevel_schema { readonly schema = schemaFor(Mid); }

describe('when decoding nested fields with multilevel derivatives', given(a_multilevel_schema, context => {
    it('should accept the declared intermediate type by its own discriminator', () => {
        (decode(Mid, context.schema.parse({ title: 'title', note: 'note', _derivedTypeId: 'mid' })) as Mid)
            .should.be.instanceOf(Mid);
    });
    it('should accept a leaf discriminator', () => {
        (decode(Mid, context.schema.parse({ title: 'title', note: 'note', extra: 'more', _derivedTypeId: 'leaf' })) as Leaf)
            .should.be.instanceOf(Leaf);
    });
    it('should write a discriminator and retain null only through a polymorphic declared field', () => {
        const item = Object.assign(new Mid(), { title: 'title', note: null });
        (encode(Object.assign(new Envelope(), { item })) as object).should.deep.equal({
            item: { title: 'title', note: null, _derivedTypeId: 'mid' }
        });
        (encode(item) as object).should.deep.equal({ title: 'title' });
    });
}));
