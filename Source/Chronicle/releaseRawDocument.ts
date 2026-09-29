// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IEventStore } from '@cratis/chronicle';
import { getReadModelMetadata, ReadModelSubjectResolver } from '@cratis/chronicle/readModels';
import { JsonSchemaGenerator } from '@cratis/chronicle/schemas';
import type { JsonSchema } from '@cratis/chronicle/schemas';
import type { Constructor } from '@cratis/fundamentals';

function isPlainObject(value: object): boolean {
    const prototype = Object.getPrototypeOf(value) as unknown;
    return prototype === Object.prototype || prototype === null;
}

/** Accept only JSON-safe values declared by the schema, so nothing protected can pass under an unknown name or type. */
function assertReleasable(value: unknown, schema: JsonSchema, path: string): void {
    if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return;
    if (Array.isArray(value)) {
        if (!schema.items) throw new Error(`Raw document array ${path} has no declared item schema`);
        value.forEach((item, index) => assertReleasable(item, schema.items!, `${path}[${index}]`));
        return;
    }
    if (typeof value !== 'object' || !isPlainObject(value))
        throw new Error(`Raw document value ${path} is not a JSON value that can be released`);
    const properties = schema.properties;
    if (!properties) throw new Error(`Raw document object ${path} has no declared properties`);
    for (const [key, item] of Object.entries(value)) {
        const property = Object.hasOwn(properties, key) ? properties[key] : undefined;
        if (!property) throw new Error(`Raw document field ${path}.${key} is not declared on the read model`);
        assertReleasable(item, property, `${path}.${key}`);
    }
}

/**
 * Bookkeeping the Chronicle kernel stamps onto every stored read-model document (`WellKnownProperties.All`). It is
 * not read-model data unless the read model declares the property itself.
 */
const kernelBookkeeping = ['__lastHandledEventSequenceNumber', '__initialized', '__subject', '__subjects'];

function isEmptySubjectMap(value: unknown): boolean {
    return value === null || value === undefined ||
        typeof value === 'object' && isPlainObject(value) && Object.keys(value).length === 0;
}

/**
 * Release one raw storage document of a protected Chronicle read model for an explicit subject. The document keeps
 * its `_id` and declared fields; every declared field is replaced by Chronicle's released value, and undeclared
 * kernel bookkeeping is removed. Fails rather than returning anything Chronicle did not release.
 */
export async function releaseRawDocument(model: Constructor<object>, document: object, subject: string,
    store: IEventStore): Promise<object> {
    if (typeof document !== 'object' || document === null || !isPlainObject(document))
        throw new Error(`Raw ${model.name} document must be a plain object`);
    const schema = getReadModelMetadata(model)?.schema ?? JsonSchemaGenerator.generate(model);
    const declared = schema.properties ?? {};
    const { _id: key, ...stored } = document as Record<string, unknown>;
    // The kernel encrypts with the subject it stamps and releases per-property subjects on their own keys.
    const storedSubject = stored.__subject;
    if (storedSubject !== undefined && storedSubject !== null && storedSubject !== subject)
        throw new Error(`Raw ${model.name} document subject does not match the subject Chronicle stored`);
    if (!isEmptySubjectMap(stored.__subjects))
        throw new Error(`Raw ${model.name} documents with per-property compliance subjects (__subjects) cannot be released`);
    const fields: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(stored))
        if (!kernelBookkeeping.includes(name) || Object.hasOwn(declared, name)) fields[name] = value;
    assertReleasable(fields, schema, model.name);
    const instance = Object.assign(Reflect.construct(model, []) as object, fields);
    if (!Object.hasOwn(fields, 'id')) Reflect.set(instance, 'id', subject);
    if (ReadModelSubjectResolver.resolveFrom(model, instance) !== subject)
        throw new Error(`Raw ${model.name} document subject does not match its declared subject`);
    const released = await store.readModels.release(model, instance) as Record<string, unknown> | null;
    if (!released || typeof released !== 'object') throw new Error(`Chronicle returned no released ${model.name}`);
    const result: Record<string, unknown> = Object.hasOwn(document, '_id') ? { _id: key } : {};
    for (const name of Object.keys(fields)) {
        if (!Object.hasOwn(released, name)) throw new Error(`Chronicle did not release field ${model.name}.${name}`);
        result[name] = released[name];
    }
    return result;
}
