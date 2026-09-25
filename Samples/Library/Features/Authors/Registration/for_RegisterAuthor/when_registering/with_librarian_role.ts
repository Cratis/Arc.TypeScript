// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario, given } from '@cratis/arc.testing';
import { AuthorId } from '../../../AuthorId.js';
import { AuthorName } from '../../../AuthorName.js';
import { AuthorNameValidator } from '../../../AuthorNameValidator.js';
import { Authors } from '../../../Authors.js';
import { RegisterAuthor, RegisterAuthorValidator } from '../../Registration.js';
import { metadata } from '../../../../generatedMetadata.js';

class a_library_with_a_librarian {
    authors = new Authors();
    scenario = CommandScenario.for(RegisterAuthor, RegisterAuthorValidator, AuthorNameValidator);
    constructor() {
        this.scenario.extend(builder => builder.useGeneratedMetadata(metadata));
        this.scenario.services.addSingleton(Authors, this.authors);
        this.scenario.withContext({ principal: { id: 'librarian', isAuthenticated: true, roles: ['Librarian'] } });
    }
}

describe('when registering an author with a librarian role', given(a_library_with_a_librarian, context => {
    const id = AuthorId.create();
    let result: Awaited<ReturnType<typeof context.scenario.execute>>;
    beforeAll(async () => { result = await context.scenario.execute({ id, name: new AuthorName('Ursula Le Guin') }); });
    afterAll(async () => { await context.scenario.dispose(); });
    it('should register the author', async () => {
        result.shouldBeSuccessful();
        (await context.authors.all())[0]?.name.value.should.equal('Ursula Le Guin');
    });
}));
