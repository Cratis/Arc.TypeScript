// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryScenario } from '@cratis/arc.testing';
import { ChronicleReadModels } from '@cratis/arc.chronicle';
import { AuthorId } from '../../../AuthorId.js';
import { AuthorName } from '../../../AuthorName.js';
import { Author } from '../../Listing.js';
import { metadata } from '../../../../generatedMetadata.js';

describe('when paging projected authors with multiple entries', () => {
    const scenario = QueryScenario.for<{ id: string; name: string }[]>(Author, 'authorsPage');
    scenario.extend(builder => builder.useGeneratedMetadata(metadata));
    const authors = [
        Object.assign(new Author(), { id: AuthorId.create(), name: new AuthorName('Zora') }),
        Object.assign(new Author(), { id: AuthorId.create(), name: new AuthorName('Alice') })
    ];
    scenario.services.addScoped(ChronicleReadModels, () => ({
        getAll: async () => authors
    }) as unknown as ChronicleReadModels);
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeAll(async () => {
        result = await scenario.perform({}, { paging: { page: 0, pageSize: 1 }, sorting: { field: 'name', direction: 'asc' } });
    });
    afterAll(async () => { await scenario.dispose(); });
    it('should return the first sorted author and total count', () => {
        result.isSuccess.should.equal(true);
        result.data?.[0]?.name.should.equal('Alice');
        result.paging.totalItems.should.equal(2);
    });
});
