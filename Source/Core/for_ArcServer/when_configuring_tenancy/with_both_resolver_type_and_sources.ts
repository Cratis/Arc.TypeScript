// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';

describe('when configuring tenancy with both a resolver type and ordered sources', () => {
    let error: unknown;
    beforeEach(() => {
        try { new ArcServer({ tenancy: { resolverType: 'fixed', sources: ['header'] } }); }
        catch (caught) { error = caught; }
    });
    it('should refuse the conflicting resolution policies', () => {
        should().equal(error instanceof Error, true);
        (error as Error).message.should.equal('Choose tenant sources or resolverType');
    });
});
