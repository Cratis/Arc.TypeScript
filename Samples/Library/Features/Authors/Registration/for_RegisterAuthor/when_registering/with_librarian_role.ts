// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { ChronicleCommandScenario } from '@cratis/arc.chronicle/testing';
import { AuthorId } from '../../../AuthorId.js';
import { AuthorName, AuthorNameValidator } from '../../../AuthorName.js';
import { AuthorRegistered, RegisterAuthor } from '../../Registration.js';

class a_library_with_a_librarian {
    scenario = ChronicleCommandScenario.for(RegisterAuthor, AuthorRegistered, AuthorNameValidator);
    constructor() {
        Object.assign(this.scenario.context, { principal: { id: 'librarian', isAuthenticated: true, roles: ['Librarian'] } });
    }
}

describe('when registering an author with a librarian role', given(a_library_with_a_librarian, context => {
    const id = AuthorId.create();
    let result: Awaited<ReturnType<typeof context.scenario.execute>>;
    beforeAll(async () => { result = await context.scenario.execute({ id, name: new AuthorName('Ursula Le Guin') }); });
    afterAll(async () => { await context.scenario.dispose(); });
    it('should append the registration to the author stream', () => {
        result.shouldBeSuccessful();
        result.shouldHaveAppendedEvent(AuthorRegistered, id.toString(), event => event.name.value === 'Ursula Le Guin');
    });
}));
