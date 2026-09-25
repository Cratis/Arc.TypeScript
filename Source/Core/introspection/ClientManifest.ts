// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { ArcServer } from '../ArcServer.js';
import type { ClientField } from './ClientField.js';
import type { ClientType } from './ClientType.js';
import type { ClientOperation } from './ClientOperation.js';

export interface ClientManifest {
    product: '@cratis/arc.core';
    version: 1;
    operations: readonly ClientOperation[];
}
const identifier = /^[A-Za-z][A-Za-z0-9_]*$/;
// Generated modules use bare constructors and imports; local declarations cannot shadow them.
const emittedBindings = new Set(['String', 'Number', 'Boolean', 'Object', 'Symbol', 'Reflect', 'TypeError', 'Error', 'Array', 'JSON', 'Promise', 'Date', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Function', 'Proxy', 'BigInt', 'RegExp', 'Math', 'undefined', 'NaN', 'Infinity', 'globalThis', 'field', 'Command', 'QueryFor', 'ObservableQueryFor', 'QueryHttpMethod', 'PropertyDescriptor', 'ParameterDescriptor']);
const reservedQueryArguments = new Set(['page', 'pagesize', 'sortby', 'sortdirection']);
const clientMembers = new Set(['execute', 'validate', 'perform', 'subscribe', 'dispose', 'route', 'roles', 'propertyDescriptors', 'parameterDescriptors', 'requestParameters', 'requiredRequestParameters', 'defaultValue', 'queryName', 'parameters', 'paging', 'sorting', 'abortController', 'validation', 'clear', 'revertChanges', 'hasChanges', 'onPropertyChanged', 'propertyChanged', 'setInitialValues', 'setInitialValuesFromCurrentValues', 'setOrigin', 'setApiBasePath', 'setMicroservice', 'setHttpHeadersCallback', 'setHttpMethod', 'modelType', 'enumerable', 'then', 'toString', 'valueOf', 'hasOwnProperty']);
const keywords = new Set(['class', 'default', 'function', 'var', 'let', 'const', 'export', 'import', 'extends', 'implements', 'new', 'return', 'switch', 'case', 'if', 'else', 'void', 'null', 'true', 'false', 'enum', 'interface', 'package', 'private', 'public', 'protected', 'static', 'async', 'await', 'yield', 'delete', 'in', 'instanceof', 'this', 'super', 'try', 'catch', 'throw', 'typeof', 'with', 'do', 'while', 'for', 'break', 'continue', 'finally', 'debugger']);
// Only generated class bindings need these restrictions; they remain valid property names.
const forbiddenClassNames = new Set(['eval', 'arguments', 'string', 'number', 'boolean', 'object', 'symbol', 'bigint', 'any', 'unknown', 'never']);
const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
function fail(location: string, detail: string): never { throw new Error(`Client manifest ${location}: ${detail}`); }
function name(value: unknown, location: string, className = false): string {
    if (typeof value !== 'string' || !identifier.test(value) || value.length > 128 || keywords.has(value) || className && forbiddenClassNames.has(value) || clientMembers.has(value) || emittedBindings.has(value) || ['constructor', 'prototype', '__proto__'].includes(value)) fail(location, 'unsafe identifier');
    return value;
}
function fields(value: unknown, location: string, depth: number): ClientField[] {
    if (!Array.isArray(value) || value.length > 128) fail(location, 'expected at most 128 fields');
    const result = value.map((field: unknown, index): ClientField => {
        const at = `${location}[${index}]`;
        if (!plain(field) || Object.keys(field).some(key => !['name', 'type', 'optional'].includes(key))) fail(at, 'invalid field');
        if (field.optional !== undefined && typeof field.optional !== 'boolean') fail(at, 'optional must be boolean');
        const type = parseType(field.type, `${at}.type`, depth + 1);
        if (type.kind === 'void') fail(at, 'void is not a field');
        return { name: name(field.name, at), type, ...(field.optional === true ? { optional: true } : {}) };
    });
    const names = result.map(field => field.name.toLowerCase());
    if (new Set(names).size !== names.length) fail(location, 'duplicate or case-colliding field');
    return result.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}
function parseType(value: unknown, location: string, depth = 0): ClientType {
    if (depth > 8 || !plain(value) || typeof value.kind !== 'string') fail(location, 'unsupported or recursive type');
    if (['void', 'string', 'boolean', 'number'].includes(value.kind)) {
        if (Object.keys(value).length !== 1) fail(location, 'unexpected type metadata');
        if (value.kind === 'void') return { kind: 'void' };
        if (value.kind === 'string') return { kind: 'string' };
        if (value.kind === 'boolean') return { kind: 'boolean' };
        return { kind: 'number' };
    }
    if (value.kind === 'enum') {
        if (Object.keys(value).some(key => !['kind', 'values'].includes(key)) || !Array.isArray(value.values) || value.values.length === 0 || value.values.length > 128 ||
            value.values.some(item => typeof item !== 'string' || item.length > 1024) || new Set(value.values).size !== value.values.length) fail(location, 'invalid string enum');
        return { kind: 'enum', values: [...value.values].sort() as string[] };
    }
    if (value.kind === 'array') {
        if (Object.keys(value).some(key => !['kind', 'element'].includes(key))) fail(location, 'unexpected array metadata');
        const element = parseType(value.element, `${location}.element`, depth + 1);
        if (element.kind === 'void' || element.kind === 'array') fail(location, 'unsupported array element');
        return { kind: 'array', element };
    }
    if (value.kind === 'dto') {
        if (Object.keys(value).some(key => !['kind', 'name', 'fields'].includes(key))) fail(location, 'unexpected DTO metadata');
        const typeName = name(value.name, `${location}.name`, true);
        const members = fields(value.fields, `${location}.fields`, depth + 1);
        if (members.some(member => member.type.kind === 'dto' || member.type.kind === 'array' && member.type.element.kind === 'dto')) fail(location, 'nested DTO is unsupported');
        return { kind: 'dto', name: typeName, fields: members };
    }
    return fail(location, `unsupported type ${value.kind}`);
}
/** Parse untrusted JSON without trusting prototypes, aliases, unsupported shapes or version drift. */
export function validateClientManifest(value: unknown): ClientManifest {
    if (!plain(value) || value.product !== '@cratis/arc.core' || value.version !== 1 || !Array.isArray(value.operations) || (value.operations.length === 0 || value.operations.length > 1024) ||
        Object.keys(value).some(key => !['product', 'version', 'operations'].includes(key))) fail('root', 'unsupported product, version or structure');
    const operations: ClientOperation[] = value.operations.map((raw: unknown, index): ClientOperation => {
        const at = `operations[${index}]`;
        if (!plain(raw) || Object.keys(raw).some(key => !['id', 'kind', 'route', 'methods', 'queryName', 'roles', 'authentication', 'dynamicAuthorization', 'input', 'output'].includes(key))) fail(at, 'invalid descriptor');
        const id = raw.id;
        if (typeof id !== 'string' || id.length > 180 || keywords.has(id) || !id.split('.').every(part => identifier.test(part) && part.length <= 128 && !['constructor', 'prototype', '__proto__'].includes(part)) || emittedBindings.has(id.split('.').join('_')) || forbiddenClassNames.has(id.split('.').join('_'))) fail(at, 'unsafe qualified ID');
        if (raw.kind !== 'command' && raw.kind !== 'query' && raw.kind !== 'observable') fail(at, 'invalid operation kind');
        if (typeof raw.route !== 'string' || raw.route.length > 1024 || !/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(raw.route) || raw.route.includes('..') || raw.route.includes('//')) fail(at, 'unsafe fixed route');
        const declaredMethods = raw.methods;
        const methods = raw.kind === 'command' ? ['POST'] : Array.isArray(declaredMethods) && declaredMethods.length === 1 ? ['GET'] : ['GET', 'QUERY'];
        if (!Array.isArray(declaredMethods) || declaredMethods.length !== methods.length || methods.some((method, i) => declaredMethods[i] !== method)) fail(at, 'methods contradict client capabilities');
        if (raw.kind !== 'command' ? raw.queryName !== id : raw.queryName !== undefined)
            fail(at, 'queryName contradicts qualified ID');
        if (!Array.isArray(raw.roles) || raw.roles.length > 128 || raw.roles.some(role => typeof role !== 'string' || !role || role.length > 256)) fail(at, 'invalid roles');
        if (typeof raw.dynamicAuthorization !== 'boolean') fail(at, 'missing dynamic authorization flag');
        if (!['anonymous', 'authenticated', 'default'].includes(raw.authentication as string) || raw.authentication === 'anonymous' && raw.roles.length || raw.authentication === 'default' && raw.roles.length)
            fail(at, 'authentication contradicts effective roles');
        const input = fields(raw.input, `${at}.input`, 0);
        if (raw.kind !== 'command' && input.some(field => reservedQueryArguments.has(field.name.toLowerCase()) ||
            raw.kind === 'observable' && ['waitforfirstresult', 'waitforfirstresulttimeout'].includes(field.name.toLowerCase())))
            fail(at, 'reserved GET query argument');
        const output = parseType(raw.output, `${at}.output`);
        if (raw.kind !== 'command' && (output.kind === 'void' || ['string', 'boolean', 'number', 'enum'].includes(output.kind)))
            fail(at, 'scalar query results can lose false/zero/empty values in published client');
        if (input.some(field => field.type.kind === 'dto' || field.type.kind === 'array' && field.type.element.kind === 'dto')) fail(at, 'object input unsupported by client binder');
        return { id, kind: raw.kind, route: raw.route, methods, ...(raw.kind !== 'command' ? { queryName: id } : {}), roles: [...raw.roles].sort() as string[], authentication: raw.authentication as ClientOperation['authentication'], dynamicAuthorization: raw.dynamicAuthorization, input, output };
    });
    // Measure only the sanitized copy: never serialize the caller's objects or execute toJSON.
    if (JSON.stringify(operations).length > 1024 * 1024) fail('root', 'manifest exceeds 1 MiB');
    const seen = new Set<string>(); const routes = new Set<string>(); const symbols = new Set<string>();
    for (const operation of operations) {
        const id = operation.id.toLowerCase();
        const route = operation.route.toLowerCase();
        const symbol = operation.id.split('.').join('_').toLowerCase();
        if (seen.has(id) || routes.has(route) || symbols.has(symbol) || routes.has(`${route}/validate`) || operation.kind === 'command' && routes.has(route.replace(/\/validate$/, '')))
            fail(operation.id, 'duplicate ID, generated symbol or route');
        seen.add(id); symbols.add(symbol); routes.add(route);
        if (operation.kind === 'command') routes.add(`${route}/validate`);
    }
    return { product: '@cratis/arc.core', version: 1, operations: operations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) };
}
function zodType(schema: z.ZodType, location: string): ClientType {
    const definition = schema._zod.def;
    if ('coerce' in definition && definition.coerce === true) fail(location, 'coercion is unsupported');
    if (!(schema instanceof z.ZodNumber) && 'checks' in definition && Array.isArray(definition.checks) && definition.checks.length)
        fail(location, 'refinements or constraints are unsupported');
    if (schema instanceof z.ZodString || schema instanceof z.ZodBoolean) {
        return { kind: schema instanceof z.ZodString ? 'string' : 'boolean' };
    }
    if (schema instanceof z.ZodNumber) {
        if (!('checks' in definition) || !Array.isArray(definition.checks) || definition.checks.length !== 1 || definition.checks.some(check => {
            const item: unknown = check._zod.def;
            return !plain(item) || item.check !== 'number_format' || item.format !== 'safeint';
        })) fail(location, 'only finite safe-integer Zod numbers are supported');
        return { kind: 'number' };
    }
    if (schema instanceof z.ZodEnum) {
        const values = Object.values(schema.enum);
        if (values.some(value => typeof value !== 'string')) fail(location, 'numeric enum unsupported');
        return { kind: 'enum', values: values as string[] };
    }
    if (schema instanceof z.ZodArray) {
        const element = zodType(schema.element as z.ZodType, `${location}[]`);
        if (element.kind === 'array' || element.kind === 'void' || element.kind === 'dto') fail(location, 'unsupported input array element');
        return { kind: 'array', element };
    }
    return fail(location, `unsupported Zod type ${definition.type}; defaults, nullable, transforms and refinements require a separate proven contract`);
}
/** Preflight before ArcServer's legacy JSON Schema conversion, which can evaluate Zod default factories. */
export function inspectClientInput(schema: z.ZodType, id: string): ClientField[] {
        if (!(schema instanceof z.ZodObject)) fail(id, 'input must be a closed Zod object');
        const def = schema._zod.def;
        if (def.catchall && !(def.catchall instanceof z.ZodNever)) fail(id, 'open input object unsupported');
        if ('checks' in def && Array.isArray(def.checks) && def.checks.length) fail(id, 'object refinements are unsupported');
        const input: ClientField[] = Object.entries(schema.shape).map(([fieldName, original]) => {
            let field = original;
            if (!(field instanceof z.ZodNumber) && 'checks' in field._zod.def && Array.isArray(field._zod.def.checks) && field._zod.def.checks.length) fail(`${id}.${fieldName}`, 'field refinements are unsupported');
            const optional = field instanceof z.ZodOptional;
            if (optional) field = field.unwrap();
            if (field instanceof z.ZodDefault || original instanceof z.ZodDefault) fail(`${id}.${fieldName}`, 'Zod defaults may execute user functions during export');
            const type = zodType(field, `${id}.${fieldName}`);
            if (type.kind === 'void') fail(`${id}.${fieldName}`, 'void input unsupported');
            return { name: fieldName, type, ...(optional ? { optional: true } : {}) };
        });
        return input;
}
/** Reject reserved GET names before schema conversion without invoking application callbacks. */
export function inspectClientQueryInput(schema: z.ZodType, id: string): void {
    if (schema instanceof z.ZodObject && Object.keys(schema.shape).some(key => reservedQueryArguments.has(key.toLowerCase())))
        fail(id, 'reserved GET query argument');
}
/** No handler, validator, authorization callback, service factory or Zod default is invoked by export. */
export function exportClientManifest(server: ArcServer): ClientManifest {
    const operations = [...server.commands, ...server.queries].filter(operation => !operation.internal).map(operation => {
        const id = operation.fullyQualifiedName;
        if (!operation.clientOutput) fail(id, 'missing explicit client output metadata');
        const input = inspectClientInput(operation.schema, id);
        return {
            id, kind: 'observable' in operation && operation.observable === true ? 'observable' : operation.kind, route: operation.route,
            methods: server.endpoints.get(operation.route)?.split(', ') ?? [],
            ...(operation.kind === 'query' ? { queryName: id } : {}),
            roles: [...new Set((operation.authorization?.requirements ?? [operation.authorization])
                .flatMap(requirement => requirement?.roles ?? []))],
            authentication: operation.authorization?.anonymous ? 'anonymous' :
                operation.authorization?.authenticated || operation.authorization?.requirements?.some(requirement => requirement.authenticated || requirement.roles?.length || requirement.policy || requirement.schemes?.length) ||
                    operation.authorization?.roles?.length || operation.authorization?.policy || operation.authorization?.schemes?.length ? 'authenticated' : 'default',
            dynamicAuthorization: operation.dynamicAuthorization === true,
            input, output: operation.clientOutput.output
        };
    });
    return validateClientManifest({ product: '@cratis/arc.core', version: 1, operations });
}
/** Reject successful envelopes that would lie about a declared client output. Never include values in the error. */
export function assertClientOutput(type: ClientType, value: unknown): unknown {
    // JSON is the HTTP boundary. Snapshot once so later envelope serialization cannot
    // invoke a handler's getters or toJSON a second time with different values.
    const serialized = type.kind === 'void' ? undefined : JSON.stringify(value);
    const wire = type.kind === 'void' ? value : serialized === undefined ? undefined : JSON.parse(serialized) as unknown;
    const valid = (shape: ClientType, data: unknown, depth: number): boolean => {
        if (depth > 8) return false;
        if (shape.kind === 'void') return data === undefined;
        if (shape.kind === 'string') return typeof data === 'string';
        if (shape.kind === 'boolean') return typeof data === 'boolean';
        if (shape.kind === 'number') return typeof data === 'number' && Number.isFinite(data) && Math.abs(data) <= Number.MAX_SAFE_INTEGER;
        if (shape.kind === 'enum') return typeof data === 'string' && shape.values.includes(data);
        if (shape.kind === 'array') return Array.isArray(data) && data.every(item => valid(shape.element, item, depth + 1));
        return plain(data) && shape.fields.every(field => field.optional && (!Object.hasOwn(data, field.name) || data[field.name] === undefined) || valid(field.type, data[field.name], depth + 1)) &&
            Object.keys(data).every(key => shape.fields.some(field => field.name === key));
    };
    if (!valid(type, wire, 0)) throw new Error('Declared client output does not match wire shape');
    return wire;
}
