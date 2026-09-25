// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@command({ namespace: 'Company.Tasks.Registration' })
class RouteCommand { handle(): void {} }

describe('when applying nested route options to a folder-style namespace', given(an_application_builder, context => {
    let route: string;
    beforeEach(async () => {
        const builder = context.create({ generatedApis: {
            routePrefix: 'public', segmentsToSkipForRoute: 1, includeCommandNameInRoute: true
        } });
        builder.add(RouteCommand);
        const application = await builder.build();
        try { route = application.server.commands[0]!.route; }
        finally { await application.dispose(); }
    });
    it('should skip only the configured namespace segment', () => {
        route.should.equal('/public/tasks/registration/route-command');
    });
}));
