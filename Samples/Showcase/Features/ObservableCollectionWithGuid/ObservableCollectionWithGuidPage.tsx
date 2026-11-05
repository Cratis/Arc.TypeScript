// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AddItemForm } from './Adding/AddItemForm';
import { ItemList } from './Listing/ItemList';

export function ObservableCollectionWithGuidPage() {
    return <section><h2>Observable collection with Guid ids</h2><AddItemForm /><ItemList /></section>;
}
