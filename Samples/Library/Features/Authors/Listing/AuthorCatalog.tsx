// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useState } from 'react';
import { useDialog } from '@cratis/arc.react/dialogs';
import { Column, DataPage, MenuItem } from '@cratis/components/DataPage';
import { AllAuthors } from './AllAuthors.proxy';
import { Author } from './Author.proxy';
import { RegisterAuthorForm } from '../Registration/RegisterAuthorForm';
import { AuthorBooks } from '../../Books/Listing/AuthorBooks';

function AuthorShelf({ item }: { item: Author }) {
    return <div className="shelf"><h3>{item.name}'s shelf</h3><AuthorBooks authorId={item.id} /></div>;
}

export function AuthorCatalog() {
    const [selected, setSelected] = useState<Author | null>(null);
    const [RegistrationDialog, showRegistration] = useDialog(RegisterAuthorForm);

    return <div className="catalog-page">
        <DataPage title="Authors & books" query={AllAuthors} emptyMessage="No authors yet." dataKey="id"
            selection={selected} onSelectionChange={event => setSelected(event.value)} detailsComponent={AuthorShelf}>
            <DataPage.MenuItems><MenuItem label="Add author" command={() => { void showRegistration(); }} /></DataPage.MenuItems>
            <DataPage.Columns><Column field="name" header="Name" sortable /></DataPage.Columns>
        </DataPage>
        <RegistrationDialog />
    </div>;
}
