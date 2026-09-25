---
title: Store GeoJSON with Fundamentals types
description: Encode Point, LineString, and Polygon fields as MongoDB GeoJSON and restore typed geometry.
---

Use the geospatial types from `@cratis/fundamentals/geospatial` when a MongoDB read model stores locations, routes, or areas. `MongoDocumentCodec` writes their geometry as GeoJSON without changing driver-wide BSON serialization.

## Point: one location

Declare `@field(Point)` on the model. Longitude comes **first**, then latitude:

```typescript
import { field } from '@cratis/fundamentals';
import { Point } from '@cratis/fundamentals/geospatial';
import { key } from '@cratis/arc.core';

class Place {
    @field(String) @key() id!: string;
    @field(Point) location!: Point;
}

const place = Object.assign(new Place(), { id: 'one', location: new Point(10, 20) });
// collection.codec.serialize(place).location -> { type: 'Point', coordinates: [10, 20] }
```

MongoDB can index the stored `location` field with a `2dsphere` index. Creating indexes and composing `$near` filters are application responsibilities; the Fundamentals `Point` is **not** a driver `GeoJSON` filter-builder argument.

## LineString: a route

A `LineString` holds two or more `Point`s. The codec writes `{ type: 'LineString', coordinates: [[10, 20], [30, 40]] }` for:

```typescript
import { LineString, Point } from '@cratis/fundamentals/geospatial';

const route = new LineString([new Point(10, 20), new Point(30, 40)]);
```

Declare the field with `@field(LineString)`. Typed reads restore `LineString` and `Point` instances, not plain arrays.

## Polygon: an area, optionally with holes

A polygon stores the outer shell first and then its interior rings. Each `LinearRing` needs at least four points; repeat the first point as the last:

```typescript
import { LinearRing, Point, Polygon } from '@cratis/fundamentals/geospatial';

const shell = new LinearRing([
    new Point(10, 20), new Point(30, 20), new Point(30, 40), new Point(10, 20)
]);
const area = new Polygon(shell);
```

Declare `@field(Polygon)` on the model. The BSON field contains `{ type: 'Polygon', coordinates: [/* shell coordinates, then holes */] }`; reads reconstruct `Polygon` and its `LinearRing`s. The codec rejects an unclosed ring, non-finite coordinates, a mismatched GeoJSON type, or missing coordinates rather than returning a misleading geometry. It does not enforce winding order, non-intersection, or MongoDB's full spatial-index rules. Validate domain geometry before writing, and use stored MongoDB field names in your own spatial filters. See [serializers](serializers.md) for the other model types and [naming policies](naming-policies.md) for stored names.
