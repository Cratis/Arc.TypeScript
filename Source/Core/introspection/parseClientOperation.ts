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

const operationKeys = ['id', 'kind', 'route', 'methods', 'queryName', 'roles', 'authentication', 'dynamicAuthorization', 'input', 'output'];
const reservedQueryArguments = new Set(['page', 'pagesize', 'sortby', 'sortdirection']);
const observableOnlyArguments = ['waitforfirstresult', 'waitforfirstresulttimeout'];

/** Whether the lower-case name is reserved for paging and sorting of GET queries. */
export const isReservedQueryArgument = (lowerCaseName: string): boolean => reservedQueryArguments.has(lowerCaseName);

const isOperationKind = (kind: unknown): kind is ClientOperationKind => Object.values(ClientOperationKind).includes(kind as ClientOperationKind);

const isSafeRoute = (route: unknown): route is string =>
    typeof route === 'string' && route.length <= 1024 && /^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(route) && !route.includes('..') && !route.includes('//');

function expectedMethods(kind: ClientOperationKind, declared: unknown): string[] {
    if (kind === ClientOperationKind.Command) return ['POST'];
    return Array.isArray(declared) && declared.length === 1 ? ['GET'] : ['GET', 'QUERY'];
}

const sameMethods = (declared: unknown, methods: readonly string[]): boolean =>
    Array.isArray(declared) && declared.length === methods.length && methods.every((method, i) => declared[i] === method);

function validateMethods(declared: unknown, kind: ClientOperationKind, at: string): string[] {
    const methods = expectedMethods(kind, declared);
    if (!sameMethods(declared, methods)) fail(at, 'methods contradict client capabilities');
    return methods;
}

const isValidRole = (role: unknown): boolean => typeof role === 'string' && role.length > 0 && role.length <= 256;

function validateRoles(roles: unknown, at: string): string[] {
    if (!Array.isArray(roles)) fail(at, 'invalid roles');
    if (roles.length > 128 || !roles.every(isValidRole)) fail(at, 'invalid roles');
    return roles as string[];
}

const isKnownAuthentication = (authentication: unknown): authentication is ClientAuthentication =>
    Object.values(ClientAuthentication).includes(authentication as ClientAuthentication);
const forbidsRoles = (authentication: ClientAuthentication): boolean =>
    authentication === ClientAuthentication.Anonymous || authentication === ClientAuthentication.Default;

function validateAuthentication(authentication: unknown, roles: readonly string[], at: string): ClientAuthentication {
    if (!isKnownAuthentication(authentication)) fail(at, 'authentication contradicts effective roles');
    if (forbidsRoles(authentication) && roles.length) fail(at, 'authentication contradicts effective roles');
    return authentication;
}

const isReservedInput = (field: ClientField, kind: ClientOperationKind): boolean => {
    const lowerCaseName = field.name.toLowerCase();
    return isReservedQueryArgument(lowerCaseName) || kind === ClientOperationKind.Observable && observableOnlyArguments.includes(lowerCaseName);
};

function validateInput(raw: unknown, kind: ClientOperationKind, at: string): ClientField[] {
    const input = fields(raw, `${at}.input`, 0);
    if (kind !== ClientOperationKind.Command && input.some(field => isReservedInput(field, kind))) fail(at, 'reserved GET query argument');
    return input;
}

const scalarOutputKinds = ['void', 'string', 'boolean', 'number', 'enum'];

function validateOutput(raw: unknown, kind: ClientOperationKind, at: string): ClientType {
    const output = parseType(raw, `${at}.output`);
    if (kind !== ClientOperationKind.Command && scalarOutputKinds.includes(output.kind))
        fail(at, 'scalar query results can lose false/zero/empty values in published client');
    return output;
}

function validateKind(kind: unknown, at: string): ClientOperationKind {
    if (!isOperationKind(kind)) fail(at, 'invalid operation kind');
    return kind;
}

function validateRoute(route: unknown, at: string): string {
    if (!isSafeRoute(route)) fail(at, 'unsafe fixed route');
    return route;
}

function validateQueryName(queryName: unknown, kind: ClientOperationKind, id: string, at: string): void {
    const expected = kind === ClientOperationKind.Command ? undefined : id;
    if (queryName !== expected) fail(at, 'queryName contradicts qualified ID');
}

function validateDynamicAuthorization(value: unknown, at: string): boolean {
    if (typeof value !== 'boolean') fail(at, 'missing dynamic authorization flag');
    return value;
}

/** Parse and validate one untrusted operation descriptor. */
export function parseClientOperation(raw: unknown, index: number): ClientOperation {
    const at = `operations[${index}]`;
    if (!plain(raw) || !hasOnlyKeys(raw, operationKeys)) fail(at, 'invalid descriptor');
    const id = qualifiedId(raw.id, at);
    const kind = validateKind(raw.kind, at);
    const route = validateRoute(raw.route, at);
    const methods = validateMethods(raw.methods, kind, at);
    validateQueryName(raw.queryName, kind, id, at);
    const roles = validateRoles(raw.roles, at);
    const dynamicAuthorization = validateDynamicAuthorization(raw.dynamicAuthorization, at);
    const authentication = validateAuthentication(raw.authentication, roles, at);
    const input = validateInput(raw.input, kind, at);
    const output = validateOutput(raw.output, kind, at);
    if (input.some(holdsDto)) fail(at, 'object input unsupported by client binder');
    return { id, kind, route, methods, ...(kind !== ClientOperationKind.Command ? { queryName: id } : {}), roles: [...roles].sort(),
        authentication, dynamicAuthorization, input, output };
}

/** Order operations by ID. */
export const sortOperations = (operations: ClientOperation[]): ClientOperation[] => operations.sort((a, b) => compareOrdinal(a.id, b.id));
