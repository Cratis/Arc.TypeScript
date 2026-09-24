// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { stringifyWire } from '../../stringifyWire.js';
should();

describe('when serializing colliding property names', () => {
    it('should fail rather than discard a value', () => {
        (() => stringifyWire({ Value: 1, value: 2 })).should.throw('Ambiguous Arc wire property names');
    });
});
