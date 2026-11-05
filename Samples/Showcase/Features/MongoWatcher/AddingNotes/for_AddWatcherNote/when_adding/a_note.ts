// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { describeWithMongo } from '../../../given/a_mongodb_database.js';
import { a_note_for_a_tenant } from '../given/a_note_for_a_tenant.js';

describeWithMongo('when adding a note', given(a_note_for_a_tenant, context => {
    beforeAll(async () => { (await context.scenario.execute({ text: 'Remember the milk' })).shouldBeSuccessful(); });
    afterAll(async () => { await context.dispose(); });

    it('should store the note in the tenant database', async () => { (await context.notes()).should.deep.equal(['Remember the milk']); });
}));
