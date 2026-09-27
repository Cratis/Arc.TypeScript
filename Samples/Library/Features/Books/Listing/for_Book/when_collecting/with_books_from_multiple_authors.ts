// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ObservableQueryScenario } from '@cratis/arc.testing';
import { ChronicleReadModels } from '@cratis/arc.chronicle';
import { of } from 'rxjs';
import { AuthorId } from '../../../../Authors/AuthorId.js';
import { BookId } from '../../../BookId.js';
import { BookTitle } from '../../../BookTitle.js';
import { Book } from '../../Listing.js';
import { metadata } from '../../../../generatedMetadata.js';

describe('when collecting books for one author with books from multiple authors', () => {
    const scenario = ObservableQueryScenario.for<{ id: string; authorId: string; title: string }[]>(Book, 'booksForAuthor');
    scenario.extend(builder => builder.useGeneratedMetadata(metadata));
    const authorId = AuthorId.create();
    const anotherAuthorId = AuthorId.create();
    const books = [
        Object.assign(new Book(), { id: BookId.create(), authorId, title: new BookTitle('Kindred') }),
        Object.assign(new Book(), { id: BookId.create(), authorId: anotherAuthorId, title: new BookTitle('Dune') })
    ];
    scenario.services.addScoped(ChronicleReadModels, () => ({
        observeAll: () => of(books)
    }) as unknown as ChronicleReadModels);
    let result: Awaited<ReturnType<typeof scenario.collect>>;
    beforeAll(async () => { result = await scenario.collect(1, 1_000, { authorId }); });
    afterAll(async () => { await scenario.dispose(); });
    it('should emit only the books belonging to the requested author', () => {
        (result.rejection === undefined).should.equal(true);
        result.emissions.should.have.lengthOf(1);
        result.emissions[0]?.data?.should.have.lengthOf(1);
        result.emissions[0]?.data?.[0]?.title.should.equal('Kindred');
        result.emissions[0]?.data?.[0]?.authorId.should.equal(authorId.toString());
    });
});
