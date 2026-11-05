// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ItemTable } from './Listing/ItemTable';
import { LatestItems } from './Listing/LatestItems';
import { ItemLookup } from './Lookup/ItemLookup';

export function QueryShowcasePage() {
    return <section><h2>Query showcase</h2><ItemTable /><LatestItems /><ItemLookup /></section>;
}
