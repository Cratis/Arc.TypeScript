// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ClientOperationKind } from '@cratis/arc.core';
import { renderSourceQuery } from '../../renderSourceQuery.js';
import type { SourceType } from '../../SourceType.js';
import { a_query } from '../given/a_query.js';

const type = (constructor: string, enumerable = false): SourceType => ({ text: constructor, constructor, enumerable, nullable: false, void: false });
const fields = [
    { name: 'record', type: type('Object') },
    { name: 'nested', type: { ...type('Detail'), model: 'Detail' } },
    { name: 'array', type: type('String', true) },
    { name: 'map', type: type('Map') },
    { name: 'polymorphic', type: { ...type('Notice'), model: 'Notice' } },
    { name: 'derived', type: { ...type('UrgentNotice'), model: 'UrgentNotice' } },
    { name: 'complexConcept', type: type('Object') },
    { name: 'scalarNamedModel', type: { ...type('Guid'), model: 'Guid' } }
].map(field => ({ ...field, optional: false, nullable: false }));

describe('when emitting sort helpers with complex fields', () => {
    let outputs: string[];
    beforeEach(() => {
        outputs = [ClientOperationKind.Query, ClientOperationKind.Observable].map(kind => renderSourceQuery({ ...a_query, kind },
            'All.ts', new Map([['Listing', 'Listing.ts']]), '/api/all', { name: 'Listing', namespace: '', kind: 'model', fields }));
    });
    for (const { name } of fields) {
        it(`should omit static and instance sorting for ${name}`, () => {
            for (const output of outputs) {
                output.should.not.contain(`readonly ${name}`);
                output.should.not.contain(`this.${name} =`);
            }
        });
    }
    it('should omit unused sorting action imports', () => {
        for (const output of outputs) output.should.not.contain('SortingActions');
    });
});
