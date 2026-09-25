// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { LineString, LinearRing, Point, Polygon } from '@cratis/fundamentals/geospatial';
import type { Document } from 'mongodb';

export type MongoGeometry = Point | LineString | Polygon;

/** Encode Fundamentals geometry as MongoDB GeoJSON, with longitude before latitude. */
export function encodeGeometry(value: MongoGeometry): Document {
    if (value instanceof Point) return { type: 'Point', coordinates: point(value) };
    if (value instanceof LineString) {
        if (value.coordinates.length < 2) throw new TypeError('GeoJSON LineString requires at least two points');
        return { type: 'LineString', coordinates: value.coordinates.map(point) };
    }
    const rings = [value.shell, ...value.holes];
    return { type: 'Polygon', coordinates: rings.map(ring => {
        const coordinates = ring.coordinates.map(point);
        if (coordinates.length < 4 || coordinates[0]![0] !== coordinates.at(-1)![0] ||
            coordinates[0]![1] !== coordinates.at(-1)![1]) throw new TypeError('GeoJSON Polygon rings must be closed');
        return coordinates;
    }) };
}

/** Reject malformed or mismatched geometry rather than returning a plausible but incorrect location. */
export function decodeGeometry(type: typeof Point | typeof LineString | typeof Polygon, document: unknown): MongoGeometry {
    if (!document || typeof document !== 'object') throw new TypeError('Invalid MongoDB GeoJSON geometry');
    const value = document as Document;
    if (value.type !== type.name || !Array.isArray(value.coordinates)) throw new TypeError(`Expected GeoJSON ${type.name}`);
    if (type === Point) return readPoint(value.coordinates);
    if (type === LineString) {
        if (value.coordinates.length < 2) throw new TypeError('GeoJSON LineString requires at least two points');
        return new LineString(value.coordinates.map(readPoint));
    }
    if (!value.coordinates.length) throw new TypeError('GeoJSON Polygon requires a shell');
    const rings = value.coordinates.map((coordinates: unknown) => {
        if (!Array.isArray(coordinates) || coordinates.length < 4) throw new TypeError('GeoJSON Polygon rings require four points');
        const points = coordinates.map(readPoint);
        if (points[0]!.longitude !== points.at(-1)!.longitude || points[0]!.latitude !== points.at(-1)!.latitude)
            throw new TypeError('GeoJSON Polygon rings must be closed');
        return new LinearRing(points);
    });
    return new Polygon(rings[0]!, rings.slice(1));
}

function point(value: Point): number[] {
    if (!Number.isFinite(value.longitude) || !Number.isFinite(value.latitude)) throw new TypeError('Invalid GeoJSON coordinate');
    return [value.longitude, value.latitude];
}

function readPoint(coordinates: unknown): Point {
    if (!Array.isArray(coordinates) || coordinates.length !== 2 ||
        typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number')
        throw new TypeError('Invalid GeoJSON coordinate');
    if (!Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]))
        throw new TypeError('Invalid GeoJSON coordinate');
    return new Point(coordinates[0], coordinates[1]);
}
