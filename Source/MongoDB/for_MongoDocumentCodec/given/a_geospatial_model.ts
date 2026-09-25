// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { LineString, Point, Polygon } from '@cratis/fundamentals/geospatial';
import { key } from '@cratis/arc.core';
import { MongoDocumentCodec } from '../../MongoDocumentCodec.js';

export class GeoRecord {
    @field(String) @key() id!: string;
    @field(Point) location!: Point;
    @field(LineString) route!: LineString;
    @field(Polygon) region!: Polygon;
}

export class a_geospatial_model {
    readonly codec = new MongoDocumentCodec(GeoRecord);
}
