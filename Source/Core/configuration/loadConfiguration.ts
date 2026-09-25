// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const boolean = z.preprocess(value => typeof value === 'string' && /^(true|false)$/i.test(value) ? value.toLowerCase() === 'true' : value, z.boolean());
const integer = (minimum: number) => z.preprocess(value => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(minimum));
const arc = z.object({
    development: boolean.optional(), enableQueryMethod: boolean.optional(), openApiVersion: z.string().optional(),
    maxBodyBytes: integer(1).optional(), correlationHeader: z.string().min(1).optional(), tenantHeader: z.string().min(1).optional(),
    generatedApis: z.object({ routePrefix: z.string().optional(), segmentsToSkipForRoute: integer(0).optional(),
        includeCommandNameInRoute: boolean.optional(), includeQueryNameInRoute: boolean.optional() }).optional()
});
const chronicle = z.object({ connectionString: z.string().min(1).optional(), eventStore: z.string().min(1).optional() });
const mongoDB = z.object({ server: z.string().min(1).optional(), database: z.string().min(1).optional() });
const schema = z.object({ Cratis: z.object({ Arc: arc.optional(), Chronicle: chronicle.optional(), MongoDB: mongoDB.optional() }).optional() });

/** Configurable, serializable Cratis settings; never includes handlers, credentials supplied as objects, or clients. */
export type CratisConfiguration = z.infer<typeof schema>;

const names: Record<string, string> = {
    cratis: 'Cratis', arc: 'Arc', chronicle: 'Chronicle', mongodb: 'MongoDB', generatedapis: 'generatedApis',
    connectionstring: 'connectionString', eventstore: 'eventStore', server: 'server', database: 'database',
    development: 'development', enablequerymethod: 'enableQueryMethod', openapiversion: 'openApiVersion', maxbodybytes: 'maxBodyBytes',
    correlationheader: 'correlationHeader', tenantheader: 'tenantHeader', routeprefix: 'routePrefix',
    segmentstoskipforroute: 'segmentsToSkipForRoute', includecommandnameinroute: 'includeCommandNameInRoute',
    includequerynameinroute: 'includeQueryNameInRoute', correlationid: 'correlationId', tenancy: 'tenancy',
    httpheader: 'httpHeader', enablequeryhttpmethod: 'enableQueryHttpMethod', exposeexceptiondetails: 'exposeExceptionDetails'
};
type Section = Record<string, unknown>;
function isSection(value: unknown): value is Section { return !!value && typeof value === 'object' && !Array.isArray(value); }
function normalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(normalize);
    if (!isSection(value)) return value;
    const result: Section = {};
    for (const [key, item] of Object.entries(value)) {
        const name = names[key.toLowerCase()] ?? key;
        if (Object.hasOwn(result, name)) throw new Error(`Duplicate configuration key: ${name}`);
        result[name] = normalize(item);
    }
    return result;
}
function merge(target: Section, source: Section): void {
    for (const [key, value] of Object.entries(source)) {
        if (isSection(value) && isSection(target[key])) merge(target[key], value);
        else target[key] = value;
    }
}
function aliases(root: Section): void {
    const cratis = root.Cratis;
    if (!isSection(cratis) || !isSection(cratis.Arc)) return;
    const settings = cratis.Arc;
    for (const [section, field] of [['correlationId', 'correlationHeader'], ['tenancy', 'tenantHeader']] as const) {
        const nested = settings[section];
        if (!isSection(nested)) continue;
        if (nested.httpHeader !== undefined && settings[field] === undefined) settings[field] = nested.httpHeader;
        delete nested.httpHeader;
    }
    if (settings.exposeExceptionDetails !== undefined) {
        if (settings.development === undefined) settings.development = settings.exposeExceptionDetails;
        delete settings.exposeExceptionDetails;
    }
    const generated = settings.generatedApis;
    if (isSection(generated) && generated.enableQueryHttpMethod !== undefined) {
        if (settings.enableQueryMethod === undefined) settings.enableQueryMethod = generated.enableQueryHttpMethod;
        delete generated.enableQueryHttpMethod;
    }
}
function warnUnknown(root: Section, logger?: (error: unknown, correlationId: string) => void): void {
    if (!logger || !isSection(root.Cratis)) return;
    const cratis = root.Cratis;
    const known: readonly [string, readonly string[]][] = [
        ['Arc', [...Object.keys(arc.shape), 'correlationId', 'tenancy']],
        ['Chronicle', Object.keys(chronicle.shape)], ['MongoDB', Object.keys(mongoDB.shape)]
    ];
    for (const [name, keys] of known) {
        const section = cratis[name];
        if (!isSection(section)) continue;
        for (const key of Object.keys(section)) if (!keys.includes(key)) logger(new Error(`Unknown Cratis configuration key: Cratis:${name}:${key}`), '');
        if (name !== 'Arc') continue;
        for (const nested of ['generatedApis', 'correlationId', 'tenancy']) {
            const child = section[nested];
            if (!isSection(child)) continue;
            const allowed = nested === 'generatedApis' ? Object.keys(arc.shape.generatedApis.unwrap().shape) : [];
            for (const key of Object.keys(child)) if (!allowed.includes(key))
                logger(new Error(`Unknown Cratis configuration key: Cratis:Arc:${nested}:${key}`), '');
        }
    }
}
function readSettings(file: string): Section {
    let source: string;
    try { source = readFileSync(file, 'utf8'); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
        throw error;
    }
    let raw: unknown;
    let invalidPosition: string | undefined;
    let invalidJson = false;
    try { raw = JSON.parse(source) as unknown; }
    catch (error) {
        invalidJson = true;
        invalidPosition = /position (\d+)/.exec((error as Error).message)?.[1];
    }
    if (invalidJson) throw new Error(`Invalid JSON configuration in ${file}${invalidPosition ? ` at position ${invalidPosition}` : ''}`);
    if (!isSection(raw)) throw new Error(`Cratis configuration in ${file} must be an object`);
    return normalize(raw) as Section;
}
/** Read appsettings.json, its environment variant and double-underscore environment overrides (Node only). */
export function loadConfiguration(file: string | URL = 'appsettings.json', env: NodeJS.ProcessEnv = process.env,
    logger?: (error: unknown, correlationId: string) => void): CratisConfiguration {
    const path = file instanceof URL ? fileURLToPath(file) : file;
    const merged = readSettings(path);
    aliases(merged);
    const environment = env.DOTNET_ENVIRONMENT ?? env.ASPNETCORE_ENVIRONMENT ?? env.NODE_ENV;
    if (environment && !/[/\\]/.test(environment)) {
        const environmentSettings = readSettings(join(dirname(path), `appsettings.${environment}.json`));
        aliases(environmentSettings);
        merge(merged, environmentSettings);
    }
    const overrides: Section = {};
    for (const [key, value] of Object.entries(env)) {
        if (!/^cratis__/i.test(key) || value === undefined) continue;
        const parts = key.split('__').map(part => names[part.toLowerCase()] ?? part);
        let current = overrides;
        for (const part of parts.slice(0, -1)) {
            if (!current[part]) current[part] = {};
            current = current[part] as Section;
        }
        current[parts.at(-1)!] = value;
    }
    aliases(overrides);
    merge(merged, overrides);
    warnUnknown(merged, logger);
    // Zod reports paths, never configuration values (which may contain credentials).
    const result = schema.safeParse(merged);
    if (!result.success) throw new Error(`Invalid Cratis configuration: ${result.error.issues.map(issue =>
        [...issue.path, issue.message === 'Invalid input' ? 'invalid value' : issue.message].join('.')).join('; ')}`);
    return result.data;
}
