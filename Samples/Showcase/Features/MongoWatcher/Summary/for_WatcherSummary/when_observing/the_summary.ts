// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { describeWithMongo } from '../../../given/a_mongodb_database.js';
import { stored_items_and_notes } from '../given/stored_items_and_notes.js';

describeWithMongo('when observing the summary of items and notes', given(stored_items_and_notes, context => {
    let result: Awaited<ReturnType<typeof context.observable.collect>>;
    beforeAll(async () => {
        await context.database.insertItems('acme', 'One', 'Two');
        await context.database.insertNotes('acme', 'First note');
        result = await context.observable.collect(1, 5_000);
    });
    afterAll(async () => { await context.dispose(); });

    it('should join both collections into one live result', () => {
        result.emissions[0]?.data?.should.deep.include({ itemCount: 2, noteCount: 1, latestNote: 'First note' });
    });
}));
