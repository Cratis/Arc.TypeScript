// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AddItemForm } from './Adding/AddItemForm';
import { ItemList } from './Listing/ItemList';

export function ObservableCollectionPage() {
    return <section><h2>Observable collection</h2><AddItemForm /><ItemList /></section>;
}
