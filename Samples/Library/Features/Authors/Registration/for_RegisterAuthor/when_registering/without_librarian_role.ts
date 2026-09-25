// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario } from '@cratis/arc.testing';
import { AuthorId } from '../../../AuthorId.js';
import { AuthorName } from '../../../AuthorName.js';
import { Authors } from '../../../Authors.js';
import { RegisterAuthor } from '../../Registration.js';
import { metadata } from '../../../../generatedMetadata.js';

describe('when registering an author without a librarian role', () => {
    const authors = new Authors();
    const scenario = CommandScenario.for(RegisterAuthor);
    scenario.extend(builder => builder.useGeneratedMetadata(metadata));
    scenario.services.addSingleton(Authors, authors);
    scenario.withContext({ principal: { id: 'reader', isAuthenticated: true, roles: [] } });
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeAll(async () => { result = await scenario.execute({ id: AuthorId.create(), name: new AuthorName('Reader') }); });
    afterAll(async () => { await scenario.dispose(); });
    it('should reject the command without a write', async () => {
        result.isAuthorized.should.equal(false);
        (await authors.all()).should.have.lengthOf(0);
    });
});
