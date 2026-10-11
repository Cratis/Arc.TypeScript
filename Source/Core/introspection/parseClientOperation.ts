// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ClientAuthentication } from './ClientAuthentication.js';
import type { ClientField } from './ClientField.js';
import type { ClientOperation } from './ClientOperation.js';
import { ClientOperationKind } from './ClientOperationKind.js';
import type { ClientType } from './ClientType.js';
import { compareOrdinal, fail, hasOnlyKeys, plain } from './manifestGuards.js';
import { qualifiedId } from './manifestIdentifiers.js';
import { fields, holdsDto, parseType } from './parseClientType.js';

// Descriptors may carry accessor properties, so every helper reads raw properties exactly where the
// original single-function validation did: the number and order of reads is part of the behavior.
type RawOperation = Record<string, unknown>;

const operationKeys = ['id', 'kind', 'route', 'methods', 'queryName', 'roles', 'authentication', 'dynamicAuthorization', 'input', 'output'];
const reservedQueryArguments = new Set(['page', 'pagesize', 'sortby', 'sortdirection']);
const observableOnlyArguments = ['waitforfirstresult', 'waitforfirstresulttimeout'];
const scalarOutputKinds = ['void', 'string', 'boolean', 'number', 'enum'];

/** Whether the lower-case name is reserved for paging and sorting of GET queries. */
export const isReservedQueryArgument = (lowerCaseName: string): boolean => reservedQueryArguments.has(lowerCaseName);

const isCommand = (raw: RawOperation): boolean => raw.kind === ClientOperationKind.Command;
const isObservable = (raw: RawOperation): boolean => raw.kind === ClientOperationKind.Observable;

function validateKind(raw: RawOperation, at: string): void {
    if (raw.kind === ClientOperationKind.Command) return;
    if (raw.kind === ClientOperationKind.Query) return;
    if (raw.kind === ClientOperationKind.Observable) return;
    fail(at, 'invalid operation kind');
}

function validateRoute(raw: RawOperation, at: string): void {
    const unsafe = (): never => fail(at, 'unsafe fixed route');
    if (typeof raw.route !== 'string') unsafe();
    if ((raw.route as string).length > 1024) unsafe();
    if (!/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(raw.route as string)) unsafe();
    if ((raw.route as string).includes('..')) unsafe();
    if ((raw.route as string).includes('//')) unsafe();
}

function expectedMethods(raw: RawOperation, declared: unknown): string[] {
    if (isCommand(raw)) return ['POST'];
    return Array.isArray(declared) && declared.length === 1 ? ['GET'] : ['GET', 'QUERY'];
}

const sameMethods = (declared: unknown, methods: readonly string[]): boolean =>
    Array.isArray(declared) && declared.length === methods.length && methods.every((method, i) => declared[i] === method);

function validateMethods(raw: RawOperation, at: string): string[] {
    const declared = raw.methods;
    const methods = expectedMethods(raw, declared);
    if (!sameMethods(declared, methods)) fail(at, 'methods contradict client capabilities');
    return methods;
}

function validateQueryName(raw: RawOperation, id: string, at: string): void {
    const contradicts = !isCommand(raw) ? raw.queryName !== id : raw.queryName !== undefined;
    if (contradicts) fail(at, 'queryName contradicts qualified ID');
}

const isValidRole = (role: unknown): boolean => typeof role === 'string' && role.length > 0 && role.length <= 256;

function validateRoles(raw: RawOperation, at: string): void {
    if (!Array.isArray(raw.roles)) fail(at, 'invalid roles');
    const roles = raw.roles as unknown[];
    if (roles.length > 128) fail(at, 'invalid roles');
    if (!(raw.roles as unknown[]).every(isValidRole)) fail(at, 'invalid roles');
}

const hasRoles = (raw: RawOperation): boolean => Boolean((raw.roles as unknown[]).length);

function validateAuthentication(raw: RawOperation, at: string): void {
    const contradiction = (): never => fail(at, 'authentication contradicts effective roles');
    if (!Object.values(ClientAuthentication).includes(raw.authentication as ClientAuthentication)) contradiction();
    if (raw.authentication === ClientAuthentication.Anonymous && hasRoles(raw)) contradiction();
    if (raw.authentication === ClientAuthentication.Default && hasRoles(raw)) contradiction();
}

const isReservedInput = (field: ClientField, raw: RawOperation): boolean => {
    const lowerCaseName = field.name.toLowerCase();
    return isReservedQueryArgument(lowerCaseName) || isObservable(raw) && observableOnlyArguments.includes(lowerCaseName);
};

function validateInput(raw: RawOperation, at: string): ClientField[] {
    const input = fields(raw.input, `${at}.input`, 0);
    if (!isCommand(raw) && input.some(field => isReservedInput(field, raw))) fail(at, 'reserved GET query argument');
    return input;
}

function validateOutput(raw: RawOperation, at: string): ClientType {
    const output = parseType(raw.output, `${at}.output`);
    if (!isCommand(raw) && scalarOutputKinds.includes(output.kind))
        fail(at, 'scalar query results can lose false/zero/empty values in published client');
    return output;
}

/** Parse and validate one untrusted operation descriptor. */
export function parseClientOperation(raw: unknown, index: number): ClientOperation {
    const at = `operations[${index}]`;
    if (!plain(raw) || !hasOnlyKeys(raw, operationKeys)) fail(at, 'invalid descriptor');
    const id = qualifiedId(raw.id, at);
    validateKind(raw, at);
    validateRoute(raw, at);
    const methods = validateMethods(raw, at);
    validateQueryName(raw, id, at);
    validateRoles(raw, at);
    if (typeof raw.dynamicAuthorization !== 'boolean') fail(at, 'missing dynamic authorization flag');
    validateAuthentication(raw, at);
    const input = validateInput(raw, at);
    const output = validateOutput(raw, at);
    if (input.some(holdsDto)) fail(at, 'object input unsupported by client binder');
    return { id, kind: raw.kind as ClientOperationKind, route: raw.route as string, methods,
        ...(!isCommand(raw) ? { queryName: id } : {}), roles: [...raw.roles as string[]].sort(),
        authentication: raw.authentication as ClientAuthentication, dynamicAuthorization: raw.dynamicAuthorization, input, output };
}

/** Order operations by ID. */
export const sortOperations = (operations: ClientOperation[]): ClientOperation[] => operations.sort((a, b) => compareOrdinal(a.id, b.id));
