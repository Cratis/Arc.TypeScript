// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { stringifyWire } from '../../stringifyWire.js';
should();

describe('when serializing colliding property names', () => {
    it('should preserve distinct dictionary keys without renaming them', () => {
        JSON.parse(stringifyWire({ Value: 1, value: 2 })).should.deep.equal({ Value: 1, value: 2 });
    });
    it('should preserve schema definitions and references verbatim', () => {
        JSON.parse(stringifyWire({ $defs: { HTTPMetric: { properties: { NewName: { type: 'string' } }, required: ['NewName'] } },
            $ref: '#/$defs/HTTPMetric' })).should.deep.equal({
            $defs: { HTTPMetric: { properties: { NewName: { type: 'string' } }, required: ['NewName'] } },
            $ref: '#/$defs/HTTPMetric'
        });
    });
});
