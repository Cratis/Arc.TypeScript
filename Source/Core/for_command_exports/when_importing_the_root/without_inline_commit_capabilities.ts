// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import * as core from '../../index.js';

should();
describe('when importing commands from the Core root', () => {
    let exportsInlineMarker: boolean;
    let exportsAcknowledgment: boolean;
    beforeEach(() => {
        exportsInlineMarker = Object.hasOwn(core, 'inlineCommitClientResponse');
        exportsAcknowledgment = Object.hasOwn(core, 'acknowledgeCommandCommit');
    });
    it('should not expose the inline commit marker', () => {
        exportsInlineMarker.should.equal(false);
    });
    it('should not expose the acknowledgment capability', () => {
        exportsAcknowledgment.should.equal(false);
    });
});
