// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ChronicleCommandScenario } from '@cratis/arc.chronicle/testing';
import { AuthorId } from '../../../AuthorId.js';
import { AuthorName } from '../../../AuthorName.js';
import { AuthorRegistered, RegisterAuthor } from '../../Registration.js';

describe('when registering an author without a librarian role', () => {
    const scenario = ChronicleCommandScenario.for(RegisterAuthor, AuthorRegistered);
    Object.assign(scenario.context, { principal: { id: 'reader', isAuthenticated: true, roles: [] } });
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeAll(async () => { result = await scenario.execute({ id: AuthorId.create(), name: new AuthorName('Reader') }); });
    afterAll(async () => { await scenario.dispose(); });
    it('should reject the command without an append', () => {
        result.isAuthorized.should.equal(false);
        result.appendedEvents.should.have.lengthOf(0);
    });
});
