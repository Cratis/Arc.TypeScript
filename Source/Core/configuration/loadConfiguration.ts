// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const arc = z.strictObject({
    development: z.boolean().optional(),
    enableQueryMethod: z.boolean().optional(),
    openApiVersion: z.string().optional(),
    maxBodyBytes: z.number().int().positive().optional(),
    correlationHeader: z.string().min(1).optional(),
    tenantHeader: z.string().min(1).optional(),
    generatedApis: z.strictObject({
        routePrefix: z.string().optional(), segmentsToSkipForRoute: z.number().int().nonnegative().optional(),
        includeCommandNameInRoute: z.boolean().optional(), includeQueryNameInRoute: z.boolean().optional()
    }).optional()
});
const chronicle = z.strictObject({ connectionString: z.string().min(1).optional(), eventStore: z.string().min(1).optional() });
const mongoDB = z.strictObject({ server: z.string().min(1).optional(), database: z.string().min(1).optional() });
const schema = z.strictObject({ Cratis: z.strictObject({ Arc: arc.optional(), Chronicle: chronicle.optional(), MongoDB: mongoDB.optional() }).optional() });

/** Configurable, serializable Cratis settings; never includes handlers, credentials supplied as objects, or clients. */
export type CratisConfiguration = z.infer<typeof schema>;

const names: Record<string, string> = {
    cratis: 'Cratis', arc: 'Arc', chronicle: 'Chronicle', mongodb: 'MongoDB', generatedapis: 'generatedApis',
    connectionstring: 'connectionString', eventstore: 'eventStore', server: 'server', database: 'database',
    development: 'development', enablequerymethod: 'enableQueryMethod', openapiversion: 'openApiVersion', maxbodybytes: 'maxBodyBytes',
    correlationheader: 'correlationHeader', tenantheader: 'tenantHeader', routeprefix: 'routePrefix',
    segmentstoskipforroute: 'segmentsToSkipForRoute', includecommandnameinroute: 'includeCommandNameInRoute',
    includequerynameinroute: 'includeQueryNameInRoute'
};

function normalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== 'object') return value;
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        const name = names[key.toLowerCase()] ?? key;
        if (Object.hasOwn(result, name)) throw new Error(`Duplicate configuration key: ${name}`);
        result[name] = normalize(item);
    }
    return result;
}

/** Read optional appsettings.json and double-underscore environment overrides (Node only). */
export function loadConfiguration(file = 'appsettings.json', env: NodeJS.ProcessEnv = process.env): CratisConfiguration {
    let raw: unknown = {};
    try { raw = JSON.parse(readFileSync(file, 'utf8')) as unknown; }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Cratis configuration must be an object');
    const merged = normalize(raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(env)) {
        if (!/^cratis__/i.test(key) || value === undefined) continue;
        const parts = key.split('__').map(part => names[part.toLowerCase()] ?? part);
        let current = merged;
        for (const part of parts.slice(0, -1)) {
            if (!current[part]) current[part] = {};
            if (typeof current[part] !== 'object' || Array.isArray(current[part]))
                throw new Error(`Invalid configuration section: ${part}`);
            current = current[part] as Record<string, unknown>;
        }
        const leaf = parts.at(-1)!;
        const parsed = value === 'true' ? true : value === 'false' ? false : /^\d+$/.test(value) ? Number(value) : value;
        current[leaf] = parsed;
    }
    // Zod reports property paths but does not include secret values in its unknown-key diagnostics.
    const result = schema.safeParse(merged);
    if (!result.success) throw new Error(`Invalid Cratis configuration: ${result.error.issues.map(issue =>
        [...issue.path, issue.code === 'unrecognized_keys' ? issue.keys.join(', ') : issue.message].join('.')).join('; ')}`);
    return result.data;
}
