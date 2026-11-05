// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AddItemForm } from './AddingItems/AddItemForm';
import { AddNoteForm } from './AddingNotes/AddNoteForm';
import { ItemList } from './ListingItems/ItemList';
import { SummaryView } from './Summary/SummaryView';

export function MongoWatcherPage() {
    return <section><h2>MongoDB with tenancy</h2>
        <p>Needs MongoDB as a replica set (<code>./run.sh</code> starts one). Each tenant has its own database: switch tenant in the toolbar.</p>
        <AddItemForm /><AddNoteForm /><SummaryView /><ItemList /></section>;
}
