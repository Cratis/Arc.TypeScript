// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { LineString, LinearRing, Point, Polygon } from '@cratis/fundamentals/geospatial';
import { given } from '../given.js';
import { a_geospatial_model, GeoRecord } from './given/a_geospatial_model.js';

should();
describe('when round tripping geospatial fields', given(a_geospatial_model, context => {
    let document: ReturnType<typeof context.codec.serialize>;
    let restored: GeoRecord;
    beforeEach(() => {
        const origin = new Point(10, 20);
        const destination = new Point(30, 40);
        const shell = new LinearRing([origin, destination, new Point(30, 20), origin]);
        const hole = new LinearRing([new Point(11, 21), new Point(12, 22), new Point(12, 21), new Point(11, 21)]);
        document = context.codec.serialize(Object.assign(new GeoRecord(), { id: 'one', location: origin,
            route: new LineString([origin, destination]), region: new Polygon(shell, [hole]) }));
        restored = context.codec.deserialize(document);
    });
    it('should store GeoJSON with longitude before latitude and polygon holes', () => {
        document.location.should.deep.equal({ type: 'Point', coordinates: [10, 20] });
        document.route.should.deep.equal({ type: 'LineString', coordinates: [[10, 20], [30, 40]] });
        document.region.coordinates.should.have.lengthOf(2);
    });
    it('should restore fundamentals geospatial instances', () => {
        restored.location.should.be.instanceOf(Point);
        restored.route.should.be.instanceOf(LineString);
        restored.region.should.be.instanceOf(Polygon);
        restored.region.holes[0]!.coordinates[1]!.latitude.should.equal(22);
    });
}));
