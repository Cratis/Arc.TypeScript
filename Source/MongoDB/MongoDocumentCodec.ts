// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, DateOnly, DerivedType, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import { fieldsFor } from '@cratis/arc.core';
import type { WireField } from '@cratis/arc.core';
import { Binary, ObjectId } from 'mongodb';
import type { Document } from 'mongodb';

/** Maps Arc field metadata to BSON without installing process-wide driver conventions. */
export class MongoDocumentCodec<T extends object> {
    readonly #fields: WireField[];
    readonly #key: string;
    constructor(private readonly type: new () => T, private readonly ignoreConventions = false) {
        this.#fields = fieldsFor(type);
        if (!this.#fields.length && !ignoreConventions) throw new Error(`MongoDB model ${type.name} requires @field metadata`);
        const keys = this.#fields.filter(field => field.options.key);
        if (keys.length > 1) throw new Error(`MongoDB model ${type.name} declares multiple keys`);
        const conventional = this.#fields.find(field => field.name === 'id' || field.name === '_id');
        if (!ignoreConventions && !keys.length && !conventional)
            throw new Error(`MongoDB model ${type.name} requires @key() or an id field`);
        this.#key = keys[0]?.name ?? conventional?.name ?? '_id';
    }
    /** Convert a model property to its BSON field name. */
    fieldName(name: string): string {
        if (name === this.#key) return '_id';
        if (!this.#fields.some(field => field.name === name)) throw new Error(`Unknown MongoDB model field: ${name}`);
        return this.ignoreConventions ? name : name[0]!.toLowerCase() + name.slice(1);
    }
    /** Encode a model for writes using the same mapping as reads. */
    serialize(value: T): Document {
        if (this.ignoreConventions) return { ...value };
        if (Reflect.get(value, this.#key) == null) throw new Error(`MongoDB model ${this.type.name} requires a key value`);
        return this.encodeObject(value.constructor as WireField['type'], value, true);
    }
    /** Materialize a document as a decorated read-model instance. */
    deserialize(document: Document): T {
        if (this.ignoreConventions) return Object.assign(new this.type(), document);
        if (!Object.hasOwn(document, '_id')) throw new Error(`MongoDB model ${this.type.name} is missing _id`);
        return this.decodeObject(this.type, document, true) as T;
    }
    /** Encode a declared identity to its MongoDB `_id` representation. */
    id(value: unknown): unknown {
        const valid = value instanceof Guid || value instanceof ConceptAs || value instanceof ObjectId || value instanceof Binary ||
            typeof value === 'string' || typeof value === 'boolean' || typeof value === 'bigint' ||
            typeof value === 'number' && Number.isFinite(value);
        if (!valid) throw new TypeError('MongoDB identity must be a primitive, Guid, concept, ObjectId, or UUID binary');
        if (this.ignoreConventions) return value;
        const field = this.#fields.find(candidate => candidate.name === this.#key);
        return field ? this.encodeValue(field.type, value, field.element) : value;
    }
    private encodeObject(type: WireField['type'], value: object, root = false): Document {
        const result: Document = {};
        const fields = fieldsFor(type);
        for (const field of fields) {
            const content = Reflect.get(value, field.name) as unknown;
            if (content !== undefined) result[field.name === this.#key && root ? '_id' :
                field.name[0]!.toLowerCase() + field.name.slice(1)] = this.encodeValue(field.type, content, field.element);
        }
        const derived = DerivedType.get(type as new () => object);
        if (derived) result._derivedTypeId = derived;
        return result;
    }
    private encodeValue(type: WireField['type'], value: unknown, element?: WireField['type']): unknown {
        if (value == null) return value;
        if (element) return (value as unknown[]).map(item => this.encodeValue(element, item));
        if (value instanceof ConceptAs) return this.encodeValue(type.valueType!, (value as ConceptAs<unknown>).value);
        if (type.prototype instanceof ConceptAs) return this.encodeValue(type.valueType!, value);
        if (type === Guid && typeof value === 'string') {
            if (!Guid.isGuid(value)) throw new TypeError('Invalid MongoDB Guid identity');
            value = Guid.parse(value);
        }
        if (value instanceof Guid) return new Binary(Buffer.from((value as Guid).toString().replaceAll('-', ''), 'hex'), Binary.SUBTYPE_UUID);
        if (value instanceof DateOnly) return new Date(`${(value as DateOnly).toString()}T12:00:00.000Z`);
        if (value instanceof TimeOnly) return new Date(`1970-01-01T${(value as TimeOnly).toString()}Z`);
        if (value instanceof TimeSpan) return (value as TimeSpan).toString();
        if (type === Date || type === String || type === Number || type === Boolean || type === ObjectId || type === Binary) return value;
        if (fieldsFor(type).length) return this.encodeObject(type, value as object);
        throw new Error(`Unsupported MongoDB model type: ${type.name}`);
    }
    private decodeObject(type: WireField['type'], document: Document, root = false): object {
        const derivatives = DerivedType.getDerivedTypesFor(type as new () => object);
        const identifier = document._derivedTypeId;
        const actual = identifier == null || !derivatives.length ? type :
            derivatives.find((candidate: new () => object) => DerivedType.get(candidate) === identifier);
        if (!actual) throw new Error(`Unknown MongoDB derived type: ${String(identifier)}`);
        const result = Reflect.construct(actual, []) as object;
        for (const field of fieldsFor(actual)) {
            const name = root && field.name === this.#key ? '_id' : field.name[0]!.toLowerCase() + field.name.slice(1);
            if (Object.hasOwn(document, name)) Reflect.set(result, field.name,
                this.decodeValue(field.type, document[name], field.element));
        }
        return result;
    }
    private decodeValue(type: WireField['type'], value: unknown, element?: WireField['type']): unknown {
        if (value == null) return value;
        if (element) return (value as unknown[]).map(item => this.decodeValue(element, item));
        if (type.prototype instanceof ConceptAs) return Reflect.construct(type, [this.decodeValue(type.valueType!, value)]);
        if (type === Guid) {
            if (!(value instanceof Binary) || value.sub_type !== Binary.SUBTYPE_UUID || value.buffer.length !== 16)
                throw new Error('MongoDB Guid requires standard UUID binary');
            const hex = Buffer.from(value.buffer).toString('hex');
            return Guid.parse(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`);
        }
        if (type === DateOnly) return DateOnly.parse((value as Date).toISOString().slice(0, 10));
        if (type === TimeOnly) return TimeOnly.parse((value as Date).toISOString().slice(11, 23));
        if (type === TimeSpan) return TimeSpan.parse(value as string);
        if (type === Date || type === String || type === Number || type === Boolean || type === ObjectId || type === Binary) return value;
        if (fieldsFor(type).length) return this.decodeObject(type, value as Document);
        throw new Error(`Unsupported MongoDB model type: ${type.name}`);
    }
}
