// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readModel, query } from '@cratis/arc.core';
import { Order } from './Order.js';

@readModel()
export class Orders {
    @query()
    static all(): Order[] { return []; }
}
