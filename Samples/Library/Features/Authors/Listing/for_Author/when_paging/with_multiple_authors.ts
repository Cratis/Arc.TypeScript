// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryScenario } from '@cratis/arc.testing';
import { AuthorId } from '../../../AuthorId.js';
import { AuthorName } from '../../../AuthorName.js';
import { Authors } from '../../../Authors.js';
import { Author } from '../../Author.js';
import { metadata } from '../../../../generatedMetadata.js';

describe('when paging authors with multiple entries', () => {
    const authors = new Authors();
    const scenario = QueryScenario.for<{ id: string; name: string }[]>(Author, 'authorsPage');
    scenario.extend(builder => builder.useGeneratedMetadata(metadata));
    scenario.services.addSingleton(Authors, authors);
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeAll(async () => {
        await authors.register(AuthorId.create(), new AuthorName('Zora'));
        await authors.register(AuthorId.create(), new AuthorName('Alice'));
        result = await scenario.perform({}, { paging: { page: 0, pageSize: 1 }, sorting: { field: 'name', direction: 'asc' } });
    });
    afterAll(async () => { await scenario.dispose(); });
    it('should return the first sorted author and total count', () => {
        result.isSuccess.should.equal(true);
        result.data?.[0]?.name.should.equal('Alice');
        result.paging.totalItems.should.equal(2);
    });
});
