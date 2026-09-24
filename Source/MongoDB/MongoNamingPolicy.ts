// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Physical names used for MongoDB documents and collections. */
export interface MongoNamingPolicy {
    propertyName(name: string): string;
    collectionName(type: new () => object): string;
}

function pluralize(name: string): string {
    if (/(s|x|z|ch|sh)$/i.test(name)) return `${name}es`;
    if (/[^aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`;
    return `${name}s`;
}

// Fundamentals ToCamelCase keeps leading acronyms intact.
function camelCase(name: string): string {
    return name.length > 1 && /^[A-Z]{2}/.test(name) ? name : name[0]?.toLowerCase() + name.slice(1);
}

/** Mirrors the default Arc .NET MongoDB builder policy for conventional names. */
export const defaultMongoNamingPolicy: MongoNamingPolicy = {
    propertyName: name => name,
    collectionName: type => pluralize(type.name)
};

/** Mirrors Arc .NET WithCamelCaseNamingPolicy() for conventional names. */
export const camelCaseMongoNamingPolicy: MongoNamingPolicy = {
    propertyName: camelCase,
    collectionName: type => camelCase(pluralize(type.name))
};
