// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { query, readModel } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@readModel({ namespace: 'Company.Tasks.Listing' })
class ListTasks {
    @query()
    static Get(): string[] { return []; }
}

describe('when excluding a query name from a folder-style route', given(an_application_builder, context => {
    let route: string;
    beforeEach(async () => {
        const builder = context.create({ generatedApis: { routePrefix: 'api', segmentsToSkipForRoute: 1,
            includeQueryNameInRoute: false } });
        builder.add(ListTasks);
        const application = await builder.build();
        try { route = application.server.queries[0]!.route; }
        finally { await application.dispose(); }
    });
    it('should retain only the namespace segments after the skipped root', () => {
        route.should.equal('/api/tasks/listing');
    });
}));
