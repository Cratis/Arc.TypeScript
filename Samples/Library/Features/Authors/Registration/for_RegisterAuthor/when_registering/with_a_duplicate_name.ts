// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario } from '@cratis/arc.testing';
import { AuthorId } from '../../../AuthorId.js';
import { AuthorName } from '../../../AuthorName.js';
import { Authors } from '../../../Authors.js';
import { RegisterAuthor } from '../../RegisterAuthor.js';
import { RegisterAuthorValidator } from '../../RegisterAuthorValidator.js';
import { metadata } from '../../../../generatedMetadata.js';

describe('when registering an author with a duplicate name', () => {
    const authors = new Authors();
    const scenario = CommandScenario.for(RegisterAuthor, RegisterAuthorValidator);
    scenario.extend(builder => builder.useGeneratedMetadata(metadata));
    scenario.services.addSingleton(Authors, authors);
    scenario.withContext({ principal: { id: 'librarian', isAuthenticated: true, roles: ['Librarian'] } });
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeAll(async () => {
        await authors.register(AuthorId.create(), new AuthorName('Octavia Butler'));
        result = await scenario.execute({ id: AuthorId.create(), name: new AuthorName('Octavia Butler') });
    });
    afterAll(async () => { await scenario.dispose(); });
    it('should reject the duplicate without storing a second author', async () => {
        result.isValid.should.equal(false);
        (await authors.all()).should.have.lengthOf(1);
    });
});
