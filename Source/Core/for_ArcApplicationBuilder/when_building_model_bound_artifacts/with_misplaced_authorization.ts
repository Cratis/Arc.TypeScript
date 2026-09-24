// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, query, readModel, roles } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@command()
class UnprotectedHandle {
    @roles('Admin')
    handle(): void {}
}

@readModel()
class UnmarkedQuery {
    @roles('Admin')
    static Get(): string { return 'unprotected'; }
}

@readModel()
class QueryField {
    @roles('Admin')
    static Get(): string { return 'protected'; }

    @query()
    static Other(): string { return 'query'; }
}

describe('when building with authorization on an uncompiled member', given(an_application_builder, context => {
    let errors: string[];
    beforeEach(async () => {
        errors = [];
        for (const type of [UnprotectedHandle, UnmarkedQuery, QueryField]) {
            const builder = context.create();
            builder.add(type);
            try { const application = await builder.build(); await application.dispose(); }
            catch (error) { errors.push((error as Error).message); }
        }
    });
    it('should reject every no-effect authorization decorator', () => {
        errors.should.deep.equal([
            'Authorization on UnprotectedHandle.handle requires @query',
            'Authorization on UnmarkedQuery.Get requires @query',
            'Authorization on QueryField.Get requires @query'
        ]);
    });
}));
