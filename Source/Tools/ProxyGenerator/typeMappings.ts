// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Import a type from another package instead of generating it into the proxy tree. */
export interface TypeMapping {
    /** The npm package (optionally with a subpath) to import from. */
    readonly package: string;
    /** The exported symbol; defaults to the mapped type's own name. */
    readonly export?: string;
}
/** Type mappings keyed by the generated type identity: root namespace, folders below the artifacts root, then the type name. */
export type TypeMappings = Readonly<Record<string, TypeMapping>>;
/** A validated mapping with its export resolved. */
export interface ResolvedTypeMapping { readonly package: string; readonly export: string }

const key = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const packageName = /^(@[a-z0-9~][a-z0-9._~-]*\/)?[a-z0-9~][a-z0-9._~-]*(\/[A-Za-z0-9._~-]+)*$/;

/** Validate mappings once, up front, so a bad entry fails before any analysis or output. */
export function resolveTypeMappings(mappings: TypeMappings | undefined): ReadonlyMap<string, ResolvedTypeMapping> {
    const resolved = new Map<string, ResolvedTypeMapping>();
    for (const [type, mapping] of Object.entries(mappings ?? {})) {
        if (!key.test(type)) throw new Error(`Invalid type mapping key '${type}': use the type's namespace-qualified name, for example Orders.Money`);
        if (typeof mapping?.package !== 'string' || !packageName.test(mapping.package))
            throw new Error(`Invalid package for type mapping '${type}': ${JSON.stringify(mapping?.package)}`);
        const exportName = mapping.export ?? type.split('.').at(-1)!;
        if (!identifier.test(exportName)) throw new Error(`Invalid export for type mapping '${type}': ${JSON.stringify(exportName)}`);
        resolved.set(type, { package: mapping.package, export: exportName });
    }
    return resolved;
}

/** Parse repeated `--type-mapping <Type>=<package>[#<export>]` values. A type may be mapped once. */
export function parseTypeMappingOptions(values: readonly string[]): TypeMappings {
    const mappings: Record<string, TypeMapping> = {};
    for (const value of values) {
        const match = /^([^=]+)=([^#=]+)(?:#([^#=]+))?$/.exec(value);
        if (!match) throw new Error(`Invalid --type-mapping '${value}': expected <Type>=<package>[#<export>]`);
        const [, type, pkg, exportName] = match as unknown as [string, string, string, string | undefined];
        if (Object.hasOwn(mappings, type)) throw new Error(`Duplicate type mapping for '${type}'`);
        mappings[type] = exportName === undefined ? { package: pkg } : { package: pkg, export: exportName };
    }
    resolveTypeMappings(mappings);
    return mappings;
}
