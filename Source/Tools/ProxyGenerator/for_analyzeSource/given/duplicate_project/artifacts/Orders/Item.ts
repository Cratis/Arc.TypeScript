// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { Item as InvoiceItem } from '../Invoices/Item.js';
export class Item {
    @field(InvoiceItem) invoice!: InvoiceItem;
}
