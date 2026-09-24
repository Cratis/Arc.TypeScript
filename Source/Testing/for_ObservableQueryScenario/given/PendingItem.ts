// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CurrentValueSubject, query, readModel } from '@cratis/arc.core';

@readModel()
export class PendingItem {
    static readonly source = CurrentValueSubject.pending<number>();

    @query({ observable: true })
    static pending(): CurrentValueSubject<number> { return PendingItem.source; }
}
