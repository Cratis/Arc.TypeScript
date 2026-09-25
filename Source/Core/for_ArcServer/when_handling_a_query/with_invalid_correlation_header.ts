// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
should();

describe('when configuring an invalid correlation header', () => {
    it('should reject it before accepting a request', () => {
        (() => new ArcServer({ correlationId: { httpHeader: 'invalid header' } })).should.throw('Invalid correlation header');
    });
});
