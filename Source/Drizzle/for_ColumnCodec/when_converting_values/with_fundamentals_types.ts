// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DrizzleDialect } from '../../DrizzleDialect.js';
import { ConceptCodecKind } from '../../ConceptCodecKind.js';
import { describe, it, should } from 'vitest';
import { ConceptAs, DateOnly, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import { conceptCodec, dateOnlyCodec, guidCodec, jsonCodec, timeOnlyCodec, timeSpanCodec } from '../../ColumnCodec.js';

should();
class TaskId extends ConceptAs<Guid> { static readonly valueType = Guid; }
class TaskName extends ConceptAs<string> { static readonly valueType = String; }
class TaskNumber extends ConceptAs<number> { static readonly valueType = Number; }

describe('when converting SQL column values', () => {
    it('should round-trip concrete concepts and provider GUID types', () => {
        const id = Guid.parse('00112233-4455-6677-8899-aabbccddeeff');
        for (const dialect of [DrizzleDialect.PostgreSQL, DrizzleDialect.MySQL, DrizzleDialect.SQLite] as const) {
            const codec = conceptCodec(TaskId, ConceptCodecKind.Guid, dialect);
            codec.fromDriver(codec.toDriver(new TaskId(id))).should.be.instanceOf(TaskId);
            codec.sqlType.should.equal(dialect === DrizzleDialect.PostgreSQL ? 'uuid'
                : dialect === DrizzleDialect.MySQL ? 'char(36)' : 'text');
            guidCodec(dialect).fromDriver(guidCodec(dialect).toDriver(id)).toString().should.equal(id.toString());
        }
        conceptCodec(TaskName, ConceptCodecKind.String, DrizzleDialect.SQLite).fromDriver('name').value.should.equal('name');
        conceptCodec(TaskNumber, ConceptCodecKind.Number, DrizzleDialect.SQLite).fromDriver(42).value.should.equal(42);
    });
    it('should reject a mismatched kind and support indexed MySQL string concepts', () => {
        (() => conceptCodec(TaskName, ConceptCodecKind.Number as ConceptCodecKind.String, DrizzleDialect.SQLite)).should.throw('does not match number');
        conceptCodec(TaskName, ConceptCodecKind.String, DrizzleDialect.MySQL, 120).sqlType.should.equal('varchar(120)');
        (() => conceptCodec(TaskName, ConceptCodecKind.String, DrizzleDialect.MySQL, 0)).should.throw('varcharLength');
    });
    it('should round-trip temporal and validated JSON data', () => {
        dateOnlyCodec.fromDriver(dateOnlyCodec.toDriver(DateOnly.parse('2026-03-02'))).toString().should.equal('2026-03-02');
        timeOnlyCodec.fromDriver(timeOnlyCodec.toDriver(TimeOnly.parse('12:34:56'))).toString().should.equal('12:34:56');
        timeSpanCodec.fromDriver(timeSpanCodec.toDriver(TimeSpan.parse('01:02:03'))).toString().should.equal('01:02:03');
        const codec = jsonCodec(DrizzleDialect.SQLite, raw => {
            if (!raw || typeof raw !== 'object' || Reflect.get(raw, 'name') !== 'item') throw new Error('Invalid JSON');
            return raw as { name: string };
        });
        codec.fromDriver(codec.toDriver({ name: 'item' })).name.should.equal('item');
    });
});
