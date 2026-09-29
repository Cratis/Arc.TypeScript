// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readModel, query } from '@cratis/arc.core';
import { Money } from '../Shared/Money.js';

@readModel()
export class Prices {
    @query()
    static current(): Money[] { return []; }
}
