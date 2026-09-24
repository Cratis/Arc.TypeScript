// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArcServer } from '../../ArcServer.js';
import { createArcNodeHandler } from '../createArcNodeHandler.js';
import { runArc } from '../runArc.js';

should();

describe('when the static root is missing or public file options are invalid', () => {
    let rejected: boolean;
    let arc: ArcServer;

    beforeEach(async () => {
        const root = join(tmpdir(), `missing-arc-node-${process.pid}-${Date.now()}`);
        arc = new ArcServer({});
        rejected = false;
        try { await runArc(arc, { port: 0, staticFiles: { root } }); }
        catch { rejected = true; }
    });

    afterEach(async () => { await arc.dispose(); });

    it('should reject the missing root at startup', () => { rejected.should.equal(true); });
    it('should reject unsafe well-known paths', () => {
        for (const wellKnown of ['.well-known/../config', '.well-known/.secret', 'anything'])
            (() => createArcNodeHandler(arc, { staticFiles: { root: '/tmp', wellKnown: [wellKnown] } })).should.throw();
    });
});
