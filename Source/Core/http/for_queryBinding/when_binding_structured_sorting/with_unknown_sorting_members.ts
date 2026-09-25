// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { structuredQuery } from '../../queryBinding.js';

should();
describe('when binding structured sorting with unknown sorting members', () => {
    let options: ReturnType<typeof structuredQuery>['options'];
    beforeEach(() => { ({ options } = structuredQuery({ sorting: { field: 'name', extra: 1 } }, z.object({}))); });
    it('should keep the recognized field', () => options.sorting!.field.should.equal('name'));
});
