// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { Binary, BSON, Decimal128, Long } from 'mongodb';
import { DateOnly, derivedType, field, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import { key } from '@cratis/arc.core';
import { MongoDocumentCodec } from '../MongoDocumentCodec.js';
import { TaskName } from './given/TaskName.js';
import { TaskDetails } from './given/TaskDetails.js';

should();
const identifier = '00112233-4455-6677-8899-aabbccddeeff';
class DotNetBase {
    @field(Guid) @key() Id!: Guid;
    @field(TaskName) Name!: TaskName;
    @field(DateOnly) Due!: DateOnly;
    @field(TimeOnly) Time!: TimeOnly;
    @field(TimeSpan) Elapsed!: TimeSpan;
    @field(Date) Created!: Date;
    @field(Array, { genericArguments: [TaskDetails] }) Details!: TaskDetails[];
}
@derivedType(identifier.toUpperCase())
class DotNetTask extends DotNetBase { @field(String) Extra!: string; }
class DotNetNumber { @field(Guid) @key() Id!: Guid; @field(Number) Amount!: number; }

describe('when decoding a .NET MongoDB BSON document', () => {
    it('should read default-policy field names, a UUID, date-only, time-only, time-span, concept and discriminator', () => {
        // BSON field values follow Arc .NET's Guid/DateOnly/TimeOnly/TimeSpan serializers.
        const bytes = BSON.serialize({
            _id: new Binary(Buffer.from(identifier.replaceAll('-', ''), 'hex'), Binary.SUBTYPE_UUID),
            Name: 'dotnet', Due: new Date('2026-05-12T12:00:00.000Z'),
            Time: new Date('1970-01-01T12:30:45.123Z'), Elapsed: '01:02:03.1230000',
            Created: new Date('2026-05-12T00:00:00.000Z'), Details: [],
            Extra: 'derived', _derivedTypeId: identifier
        });
        const model = new MongoDocumentCodec(DotNetBase).deserialize(BSON.deserialize(bytes));
        model.should.be.instanceOf(DotNetTask);
        model.Id.toString().should.equal(identifier);
        model.Name.should.be.instanceOf(TaskName);
        model.Name.value.should.equal('dotnet');
        model.Due.toString().should.equal('2026-05-12');
        model.Time.toString().should.equal('12:30:45.123');
        model.Elapsed.toString().should.equal('01:02:03.123');
        (model as DotNetTask).Extra.should.equal('derived');
    });
    it('should decode exactly representable Decimal128 and Int64 and reject lossy numbers', () => {
        const codec = new MongoDocumentCodec(DotNetNumber);
        const _id = new Binary(Buffer.from(identifier.replaceAll('-', ''), 'hex'), Binary.SUBTYPE_UUID);
        codec.deserialize({ _id, Amount: Decimal128.fromString('12.5') }).Amount.should.equal(12.5);
        codec.deserialize({ _id, Amount: Long.fromNumber(42) }).Amount.should.equal(42);
        (() => codec.deserialize({ _id, Amount: Decimal128.fromString('0.123456789123456789') })).should.throw(RangeError);
        (() => codec.deserialize({ _id, Amount: Long.fromString('9007199254740993') })).should.throw(RangeError);
    });
});
