---
title: SQL column types and conversions
---

Declare conversions in your Drizzle schema, not on the Arc read model. `pgColumn(codec)`, `mysqlColumn(codec)`, and `sqliteColumn(codec)` wrap a codec in that dialect's Drizzle `customType`. They preserve typed writes and map the driver value back on reads, including provider-paged Arc reads.

| Codec | PostgreSQL | MySQL | SQLite |
| --- | --- | --- | --- |
| `conceptCodec(ConceptType, 'string', dialect)` | `text` | `text` | `text` |
| `conceptCodec(ConceptType, 'number', dialect)` | `double precision` | `double precision` | `real` |
| `guidCodec(dialect)` and GUID concept | `uuid` | `char(36)` | `text` |
| `dateOnlyCodec` | `date` | `date` | `text` |
| `timeOnlyCodec` | `time` | `time` | `text` |
| `timeSpanCodec` | `text` | `text` | `text` |
| `jsonCodec(dialect, validate)` | `jsonb` | `json` | `text` |

Pass the concrete Fundamentals `ConceptAs<string | number | Guid>` subclass and its underlying kind to `conceptCodec`; the declared kind must match the class. Numbers must be finite. GUIDs use canonical strings in MySQL and SQLite, not binary(16); PostgreSQL uses native UUID. Unlike the .NET SQLite `GuidColumn` migration helper (`BLOB`) paired with a string value converter, this schema and converter both use text. **Do not reuse a .NET SQLite BLOB schema without a data migration.** The MySQL mapping is not yet backed by a live provider test.

`jsonCodec` requires a function that validates untrusted stored data; its decoder parses string values, then calls that function. It does not install EF's reflection-based JSON converter set. `TimeSpan` is serialized as Fundamentals text rather than a native interval, and fractional precision follows Fundamentals' `toString`/`parse`. Schema changes and nullability remain your responsibility. See [migrations](migrations.md).
