// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AddItemForm } from './Adding/AddItemForm';
import { ChangeStreamList } from './Listing/ChangeStreamList';

export function ChangeStreamPage() {
    return <section><h2>Change stream</h2><p>Observers receive the added, replaced and removed items of every change.</p><AddItemForm /><ChangeStreamList /></section>;
}
