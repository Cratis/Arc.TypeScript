// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { argument } from '../../argument.js';
import { query } from '../../query.js';
import { readModel } from '../../readModel.js';
import { compileQueries } from '../../compileQueries.js';

@readModel()
class Entries {
    @query(argument('id', String))
    static byId(id: string): string { return id; }
}
describe('when compiling a named query argument', () => {
    let compiled: ReturnType<typeof compileQueries>;
    beforeEach(() => { compiled = compileQueries(Entries, 'Samples'); });
    it('should retain the class-qualified namespace', () => {
        (compiled[0]!.definition.namespace as string).should.equal('Samples.Entries');
    });
    it('should bind the named argument', () => {
        (compiled[0]!.definition.schema.parse({ id: 'Ada' }) as { id: string }).should.deep.equal({ id: 'Ada' });
    });
});
