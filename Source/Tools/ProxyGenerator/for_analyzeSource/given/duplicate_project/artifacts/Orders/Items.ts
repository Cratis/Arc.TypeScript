// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readModel, query, argument } from '@cratis/arc.core';
import { Item as OrderItem } from './Item.js';
import { Item as InvoiceItem } from '../Invoices/Item.js';
@readModel()
export class Items {
    @query(argument('invoice', InvoiceItem))
    static current(invoice: InvoiceItem): OrderItem { void invoice; return new OrderItem(); }
    @query()
    static invoice(): InvoiceItem { return new InvoiceItem(); }
}
