// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fail } from './manifestGuards.js';

const identifier = /^[A-Za-z][A-Za-z0-9_]*$/;
const prototypeKeys = ['constructor', 'prototype', '__proto__'];

// Generated modules use bare constructors and imports; local declarations cannot shadow them.
const emittedBindings = new Set(['String', 'Number', 'Boolean', 'Object', 'Symbol', 'Reflect', 'TypeError', 'Error', 'Array', 'JSON', 'Promise', 'Date', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Function', 'Proxy', 'BigInt', 'RegExp', 'Math', 'undefined', 'NaN', 'Infinity', 'globalThis', 'field', 'Command', 'QueryFor', 'ObservableQueryFor', 'QueryHttpMethod', 'PropertyDescriptor', 'ParameterDescriptor']);
const clientMembers = new Set(['execute', 'validate', 'perform', 'subscribe', 'dispose', 'route', 'roles', 'propertyDescriptors', 'parameterDescriptors', 'requestParameters', 'requiredRequestParameters', 'defaultValue', 'queryName', 'parameters', 'paging', 'sorting', 'abortController', 'validation', 'clear', 'revertChanges', 'hasChanges', 'onPropertyChanged', 'propertyChanged', 'setInitialValues', 'setInitialValuesFromCurrentValues', 'setOrigin', 'setApiBasePath', 'setMicroservice', 'setHttpHeadersCallback', 'setHttpMethod', 'modelType', 'enumerable', 'then', 'toString', 'valueOf', 'hasOwnProperty']);
const keywords = new Set(['class', 'default', 'function', 'var', 'let', 'const', 'export', 'import', 'extends', 'implements', 'new', 'return', 'switch', 'case', 'if', 'else', 'void', 'null', 'true', 'false', 'enum', 'interface', 'package', 'private', 'public', 'protected', 'static', 'async', 'await', 'yield', 'delete', 'in', 'instanceof', 'this', 'super', 'try', 'catch', 'throw', 'typeof', 'with', 'do', 'while', 'for', 'break', 'continue', 'finally', 'debugger']);
// Only generated class bindings need these restrictions; they remain valid property names.
const forbiddenClassNames = new Set(['eval', 'arguments', 'string', 'number', 'boolean', 'object', 'symbol', 'bigint', 'any', 'unknown', 'never']);

const isIdentifierShaped = (value: unknown): value is string => typeof value === 'string' && identifier.test(value) && value.length <= 128;
const isReserved = (value: string, className: boolean): boolean => keywords.has(value) || className && forbiddenClassNames.has(value) ||
    clientMembers.has(value) || emittedBindings.has(value) || prototypeKeys.includes(value);

/** Validate a single identifier that becomes a generated member or class name. */
export function name(value: unknown, location: string, className = false): string {
    if (!isIdentifierShaped(value) || isReserved(value, className)) fail(location, 'unsafe identifier');
    return value;
}

const isSafeQualifiedId = (id: string): boolean => {
    const symbol = id.split('.').join('_');
    return id.length <= 180 && !keywords.has(id) && id.split('.').every(part => identifier.test(part) && part.length <= 128 && !prototypeKeys.includes(part)) &&
        !emittedBindings.has(symbol) && !forbiddenClassNames.has(symbol);
};

/** Validate a dotted qualified operation ID. */
export function qualifiedId(id: unknown, location: string): string {
    if (typeof id !== 'string' || !isSafeQualifiedId(id)) fail(location, 'unsafe qualified ID');
    return id;
}
