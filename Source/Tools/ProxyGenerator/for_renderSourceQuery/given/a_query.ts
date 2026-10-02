// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ClientOperationKind } from '@cratis/arc.core';
import type { SourceOperation } from '../../SourceOperation.js';

export const a_query: SourceOperation = {
    kind: ClientOperationKind.Query, name: 'All', namespace: '', owner: 'Listing', roles: [], fields: [],
    result: { text: 'Listing[]', constructor: 'Listing', model: 'Listing', enumerable: true, nullable: false, void: false }
};
