// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { given } from '../given.js';
import { a_geospatial_model } from './given/a_geospatial_model.js';

should();
describe('when rejecting invalid geometry', given(a_geospatial_model, context => {
    it('should reject a mismatched type', () => {
        (() => context.codec.deserialize({ _id: 'one', location: { type: 'Polygon', coordinates: [1, 2] } }))
            .should.throw(TypeError, 'Expected GeoJSON Point');
    });
    it('should reject an unclosed polygon ring', () => {
        (() => context.codec.deserialize({ _id: 'one', region: { type: 'Polygon', coordinates: [
            [[1, 1], [2, 1], [2, 2], [3, 3]]
        ] } })).should.throw(TypeError, 'GeoJSON Polygon rings must be closed');
    });
}));
