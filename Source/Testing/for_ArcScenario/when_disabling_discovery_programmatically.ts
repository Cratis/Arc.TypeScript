// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcScenario } from '../ArcScenario.js';

describe('when an Arc scenario disables discovery through server options', () => {
    let responses: (Response | null)[];
    beforeEach(async () => {
        const scenario = new ArcScenario({ environmentName: 'Development', introspection: { enabled: false } });
        try {
            responses = await Promise.all(['/.cratis/commands', '/.cratis/queries', '/openapi.json'].map(path =>
                scenario.handle(new Request(`http://localhost${path}`))));
        } finally { await scenario.dispose(); }
    });
    it('should leave catalog and OpenAPI requests unhandled', () => responses.should.deep.equal([null, null, null]));
});
