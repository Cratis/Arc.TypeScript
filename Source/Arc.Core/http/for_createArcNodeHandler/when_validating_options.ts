// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { createArcNodeHandler } from '../createArcNodeHandler.js';

should();

describe('when validating standalone Node handler options', () => {
    let arc: ArcServer;

    beforeEach(() => { arc = new ArcServer({}); });
    afterEach(async () => { await arc.dispose(); });

    it('should reject invalid path bases', () => {
        for (const pathBase of ['api', '/', '/x/', '/x/../y', '//api'])
            (() => createArcNodeHandler(arc, { pathBase })).should.throw();
    });
    it('should reject fallback without static files', () => {
        (() => createArcNodeHandler(arc, { fallback: 'index.html' })).should.throw();
    });
    it('should reject invalid fallback paths', () => {
        for (const fallback of ['../secret', '/etc/passwd', '.env', 'a/../index.html', 'a\\b'])
            (() => createArcNodeHandler(arc, { staticFiles: { root: '/tmp' }, fallback })).should.throw();
    });
});
