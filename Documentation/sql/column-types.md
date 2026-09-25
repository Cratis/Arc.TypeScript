---
title: SQL column types and conversions
description: Declare column codecs for concepts, GUIDs, dates, times, durations, and JSON per SQL dialect, and know where they differ from Arc on .NET.
---

A task's title is a `TaskTitle` concept in your code and plain text in the table. Drizzle columns know the driver's types, not Fundamentals concepts, GUIDs, or `DateOnly`. The column codecs close that gap: declare the conversion once on the table column, and both writes and Arc reads get your types back.

## Declare a column with a codec

```typescript
import { ConceptAs } from '@cratis/fundamentals';
import { pgTable } from 'drizzle-orm/pg-core';
import { conceptCodec, ConceptCodecKind, dateOnlyCodec, DrizzleDialect, guidCodec, pgColumn } from '@cratis/arc.drizzle';

export class TaskTitle extends ConceptAs<string> { static readonly valueType = String; }

export const tasks = pgTable('tasks', {
    id: pgColumn(guidCodec(DrizzleDialect.PostgreSQL))('id').primaryKey(),
    title: pgColumn(conceptCodec(TaskTitle, ConceptCodecKind.String, DrizzleDialect.PostgreSQL))('title').notNull(),
    due: pgColumn(dateOnlyCodec)('due')
});
```

`pgColumn(codec)`, `mysqlColumn(codec)`, and `sqliteColumn(codec)` wrap a codec in that dialect's Drizzle `customType`. The codec declares the SQL type, converts values on writes, and converts driver values back on reads, including the reads `queryPage` makes. The matching Arc read model declares `@field(Guid) id`, `@field(TaskTitle) title`, and `@field(DateOnly) due`.

The read-model codec also checks that every declared Arc field has a table column, and rebuilds GUIDs, concepts, and dates from plain driver columns when a column has no custom codec. Writes through a plain column still need the value in the driver's type, so prefer a codec column wherever a model field is not a plain string, number, or boolean.

## Codecs and SQL types

| Codec | PostgreSQL | MySQL | SQLite |
| --- | --- | --- | --- |
| `conceptCodec(ConceptType, ConceptCodecKind.String, dialect)` | `text` | `text` (or `varchar(n)` with a fourth length argument) | `text` |
| `conceptCodec(ConceptType, ConceptCodecKind.Number, dialect)` | `double precision` | `double` | `real` |
| `guidCodec(dialect)` and GUID concept | `uuid` | `char(36)` | `text` |
| `dateOnlyCodec` | `date` | `date` | `text` |
| `timeOnlyCodec` | `time` | `time` | `text` |
| `timeSpanCodec` | `text` | `text` | `text` |
| `jsonCodec(dialect, validate)` | `jsonb` | `json` | `text` |

## Rules and differences from .NET

Pass the concrete Fundamentals `ConceptAs<string | number | Guid>` subclass and its underlying kind to `conceptCodec`. Because generic types are erased at runtime, declare `static readonly valueType = String`, `Number`, or `Guid` on your concept class; registration rejects an absent or mismatched type marker. Numbers must be finite. For indexed or primary-key MySQL string concepts, pass a fourth argument such as `conceptCodec(TaskName, ConceptCodecKind.String, DrizzleDialect.MySQL, 120)` to select `varchar(120)` rather than unindexed `text`. GUIDs use canonical strings in MySQL and SQLite, not binary(16); PostgreSQL uses native UUID. Unlike the .NET SQLite `GuidColumn` migration helper (`BLOB`) paired with a string value converter, this schema and converter both use text. **Do not reuse a .NET SQLite BLOB schema without a data migration.** The MySQL mapping is not yet backed by a live provider test.

`jsonCodec` requires a function that validates untrusted stored data; its decoder parses string values, then calls that function. It does not install EF's reflection-based JSON converter set. `TimeSpan` is serialized as Fundamentals text rather than a native interval, and fractional precision follows Fundamentals' `toString`/`parse`. Text ordering is lexicographic, not duration ordering for negative or multi-day spans: do not sort by this column unless you store a separate numeric duration for ordering. Schema changes and nullability remain your responsibility. See [Own the schema](getting-started.md#own-the-schema).
