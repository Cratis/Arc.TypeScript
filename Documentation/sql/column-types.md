---
title: SQL column types and conversions
---

Declare conversions in your Drizzle schema and Fundamentals `@field` metadata on the Arc read model. `pgColumn(codec)`, `mysqlColumn(codec)`, and `sqliteColumn(codec)` wrap a codec in that dialect's Drizzle `customType`. They preserve typed writes and map the driver value back on reads, including provider-paged Arc reads. The SQL read-model codec also checks every declared Arc field has a table column and reconstructs GUIDs, concepts, and temporal values from plain driver columns if a custom column has not already done so. Writes still require an appropriate Drizzle column converter.

| Codec | PostgreSQL | MySQL | SQLite |
| --- | --- | --- | --- |
| `conceptCodec(ConceptType, 'string', dialect)` | `text` | `text` (or `varchar(n)` with a fourth length argument) | `text` |
| `conceptCodec(ConceptType, 'number', dialect)` | `double precision` | `double` | `real` |
| `guidCodec(dialect)` and GUID concept | `uuid` | `char(36)` | `text` |
| `dateOnlyCodec` | `date` | `date` | `text` |
| `timeOnlyCodec` | `time` | `time` | `text` |
| `timeSpanCodec` | `text` | `text` | `text` |
| `jsonCodec(dialect, validate)` | `jsonb` | `json` | `text` |

Pass the concrete Fundamentals `ConceptAs<string | number | Guid>` subclass and its underlying kind to `conceptCodec`. Because generic types are erased at runtime, declare `static readonly valueType = String`, `Number`, or `Guid` on your concept class; registration rejects an absent or mismatched type marker. Numbers must be finite. For indexed or primary-key MySQL string concepts, pass a fourth argument such as `conceptCodec(TaskName, 'string', 'mysql', 120)` to select `varchar(120)` rather than unindexed `text`. GUIDs use canonical strings in MySQL and SQLite, not binary(16); PostgreSQL uses native UUID. Unlike the .NET SQLite `GuidColumn` migration helper (`BLOB`) paired with a string value converter, this schema and converter both use text. **Do not reuse a .NET SQLite BLOB schema without a data migration.** The MySQL mapping is not yet backed by a live provider test.

`jsonCodec` requires a function that validates untrusted stored data; its decoder parses string values, then calls that function. It does not install EF's reflection-based JSON converter set. `TimeSpan` is serialized as Fundamentals text rather than a native interval, and fractional precision follows Fundamentals' `toString`/`parse`. Text ordering is lexicographic, not duration ordering for negative or multi-day spans: do not sort by this column unless you store a separate numeric duration for ordering. Schema changes and nullability remain your responsibility. See [migrations](migrations.md).
