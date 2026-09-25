// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { SortDirection } from '../../queries/SortDirection.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { Severity } from '../../validation/Severity.js';

should();
describe('when sorting a query with dates booleans and nulls', () => {
    let dates: unknown;
    let booleans: unknown;
    let numbers: unknown;
    beforeEach(async () => {
        const server = new ArcServer({ queries: [defineQuery({ name: 'List', schema: z.object({}), perform: () => [
            { when: new Date('2021-01-01'), enabled: true }, { when: new Date('2020-01-01'), enabled: false }
        ] })] });
        dates = (await (await server.handle(new Request('http://arc.invalid/api/list?sortBy=when')))!.json()).data[0].when;
        booleans = (await (await server.handle(new Request('http://arc.invalid/api/list?sortBy=enabled')))!.json()).data[0].enabled;
        const direct = new ArcServer({ queries: [defineQuery({ name: 'Numbers', schema: z.object({}), perform: () => [{ key: 10n }, { key: null }, { key: 2n }] })] });
        numbers = (await direct.performQuery('Numbers', {}, { correlationId: crypto.randomUUID(), tenantId: 'tenant',
            principal: undefined, allowedSeverity: Severity.Warning, signal: new AbortController().signal },
            { sorting: { field: 'key', direction: SortDirection.Ascending } })).data;
        await Promise.all([server.dispose(), direct.dispose()]);
    });
    it('should sort dates by epoch', () => dates!.should.equal('2020-01-01T00:00:00.000Z'));
    it('should sort booleans consistently', () => booleans!.should.equal(false));
    it('should sort null and bigint values consistently', () => (numbers as object).should.deep.equal([{ key: null }, { key: 2n }, { key: 10n }]));
});
