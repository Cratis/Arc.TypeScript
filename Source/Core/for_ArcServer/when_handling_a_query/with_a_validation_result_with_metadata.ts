// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, ValidationResult } from '../../index.js';
import { defineQuery } from '../../queries/defineQuery.js';

should();
describe('when handling a query with a validation result with metadata', () => {
    let status: number;
    let result: { validationResults: { state: unknown; reasonDetail: string; severity: number; members: string[]; reason: string }[] };
    beforeEach(async () => {
        const server = new ArcServer({ queries: [defineQuery({ name: 'List', schema: z.object({}), validate: () => [
            ValidationResult.error('The filter is unavailable', { state: { retryable: true }, reason: 'filterUnavailable', reasonDetail: 'Filter' })
        ], perform: () => [] })] });
        const response = (await server.handle(new Request('http://arc.invalid/api/list')))!;
        status = response.status;
        result = await response.json();
        await server.dispose();
    });
    it('should reject the query', () => status.should.equal(400));
    it('should include the error in the HTTP result', () => result.validationResults[0]!.severity.should.equal(3));
    it('should carry the state in the HTTP result', () => (result.validationResults[0]!.state as { retryable: boolean }).should.deep.equal({ retryable: true }));
    it('should carry the reason detail in the HTTP result', () => result.validationResults[0]!.reasonDetail.should.equal('Filter'));
    it('should carry the reason in the HTTP result', () => result.validationResults[0]!.reason.should.equal('filterUnavailable'));
    it('should carry the members in the HTTP result', () => result.validationResults[0]!.members.should.deep.equal([]));
});
