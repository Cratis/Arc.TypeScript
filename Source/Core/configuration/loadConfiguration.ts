// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const boolean = z.preprocess(value => typeof value === 'string' && /^(true|false)$/i.test(value) ? value.toLowerCase() === 'true' : value, z.boolean());
const integer = (minimum: number) => z.preprocess(value => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(minimum));
const interval = z.preprocess(value => {
    if (typeof value !== 'string' || !/^\d{2}:[0-5]\d:[0-5]\d(?:\.\d{1,7})?$/.test(value)) return value;
    const [hours, minutes, seconds] = value.split(':');
    return Number(hours) * 3_600_000 + Number(minutes) * 60_000 + Math.round(Number(seconds) * 1000);
}, integer(0));
const generatedApis = z.object({ routePrefix: z.string().optional(), segmentsToSkipForRoute: integer(0).optional(),
    includeCommandNameInRoute: boolean.optional(), includeQueryNameInRoute: boolean.optional(),
    enableQueryHttpMethod: boolean.optional(), openApiVersion: z.string().optional() });
const tenancy = z.object({ httpHeader: z.string().min(1).optional(),
    resolverType: z.enum(['header', 'query', 'claim', 'fixed', 'development', 'subdomain']).optional(),
    baseDomain: z.string().optional(), queryParameter: z.string().optional(), claimType: z.string().optional(),
    fixedTenantId: z.string().optional(), required: boolean.optional(), membershipClaim: z.string().optional() });
const query = z.object({ keepAliveIntervalMs: interval.optional(),
    maxObservableSubscriptions: integer(1).optional(), maxObservableSubscriptionsPerCaller: integer(1).optional(),
    maxObservableHubConnections: integer(1).optional(), maxObservableHubConnectionsPerCaller: integer(1).optional(),
    maxObservableHubSubscriptionsPerConnection: integer(1).optional(), maxObservableInboundFrames: integer(1).optional(),
    maxObservableOutboundFrames: integer(1).optional(), maxObservablePendingEmissions: integer(1).optional(),
    maxObservableInboundFrameBytes: integer(1).optional(), maxObservableOutboundFrameBytes: integer(1).optional(),
    maxObservableTombstones: integer(1).optional(), observableHandshakeTimeoutMs: integer(1).optional(),
    observableShutdownTimeoutMs: integer(1).optional(), enableObservableHealth: boolean.optional() });
const hosting = z.object({ applicationUrl: z.string().min(1).optional(), maxBodyBytes: integer(1).optional() });
const arc = z.object({ development: boolean.optional(), exposeExceptionDetails: boolean.optional(),
    correlationId: z.object({ httpHeader: z.string().min(1).optional() }).optional(), tenancy: tenancy.optional(),
    generatedApis: generatedApis.optional(), query: query.optional(), hosting: hosting.optional() });
const chronicle = z.object({ connectionString: z.string().min(1).optional(), eventStore: z.string().min(1).optional() });
const mongoDB = z.object({ server: z.string().min(1).optional(), database: z.string().min(1).optional() });
const schema = z.object({ Cratis: z.object({ Arc: arc.optional(), Chronicle: chronicle.optional(), MongoDB: mongoDB.optional() }).optional() });

/** Select the same environment used for appsettings.{Environment}.json. */
export function configurationEnvironment(env: NodeJS.ProcessEnv): string | undefined {
    return env.DOTNET_ENVIRONMENT ?? env.ASPNETCORE_ENVIRONMENT ?? env.NODE_ENV;
}

/** Configurable, serializable Cratis settings; never includes handlers, credentials supplied as objects, or clients. */
export type CratisConfiguration = z.infer<typeof schema>;

const names: Record<string, string> = {
    cratis: 'Cratis', arc: 'Arc', chronicle: 'Chronicle', mongodb: 'MongoDB', generatedapis: 'generatedApis',
    connectionstring: 'connectionString', eventstore: 'eventStore', server: 'server', database: 'database',
    development: 'development', exposeexceptiondetails: 'exposeExceptionDetails', correlationid: 'correlationId',
    tenancy: 'tenancy', query: 'query', hosting: 'hosting', httpheader: 'httpHeader',
    resolvertype: 'resolverType', basedomain: 'baseDomain', queryparameter: 'queryParameter', claimtype: 'claimType',
    fixedtenantid: 'fixedTenantId', developmenttenantid: 'fixedTenantId', required: 'required',
    membershipclaim: 'membershipClaim', routeprefix: 'routePrefix', segmentstoskipforroute: 'segmentsToSkipForRoute',
    includecommandnameinroute: 'includeCommandNameInRoute', includequerynameinroute: 'includeQueryNameInRoute',
    enablequeryhttpmethod: 'enableQueryHttpMethod', openapiversion: 'openApiVersion',
    applicationurl: 'applicationUrl', maxbodybytes: 'maxBodyBytes', keepaliveinterval: 'keepAliveIntervalMs',
    enableobservablehealth: 'enableObservableHealth', maxobservablesubscriptions: 'maxObservableSubscriptions',
    maxobservablesubscriptionspercaller: 'maxObservableSubscriptionsPerCaller',
    maxobservablehubconnections: 'maxObservableHubConnections',
    maxobservablehubconnectionspercaller: 'maxObservableHubConnectionsPerCaller',
    maxobservablehubsubscriptionsperconnection: 'maxObservableHubSubscriptionsPerConnection',
    maxobservableinboundframes: 'maxObservableInboundFrames', maxobservableoutboundframes: 'maxObservableOutboundFrames',
    maxobservablependingemissions: 'maxObservablePendingEmissions',
    maxobservableinboundframebytes: 'maxObservableInboundFrameBytes',
    maxobservableoutboundframebytes: 'maxObservableOutboundFrameBytes',
    maxobservabletombstones: 'maxObservableTombstones',
    observablehandshaketimeoutms: 'observableHandshakeTimeoutMs',
    observableshutdowntimeoutms: 'observableShutdownTimeoutMs'
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
        result[name] = name === 'resolverType' && typeof item === 'string' ? item.toLowerCase() : normalize(item);
    }
    return result;
}
function merge(target: Section, source: Section): void {
    for (const [key, value] of Object.entries(source)) {
        if (isSection(value) && isSection(target[key])) merge(target[key], value);
        else target[key] = value;
    }
}
function warnUnknown(root: Section, logger?: (error: unknown, correlationId: string) => void): void {
    if (!logger || !isSection(root.Cratis)) return;
    const cratis = root.Cratis;
    const known: readonly [string, readonly string[]][] = [
        ['Arc', Object.keys(arc.shape)],
        ['Chronicle', Object.keys(chronicle.shape)], ['MongoDB', Object.keys(mongoDB.shape)]
    ];
    for (const [name, keys] of known) {
        const section = cratis[name];
        if (!isSection(section)) continue;
        for (const key of Object.keys(section)) if (!keys.includes(key)) logger(new Error(`Unknown Cratis configuration key: Cratis:${name}:${key}`), '');
        if (name !== 'Arc') continue;
        const nestedSections = { correlationId: arc.shape.correlationId.unwrap(), tenancy, generatedApis, query, hosting };
        for (const [nested, childSchema] of Object.entries(nestedSections)) {
            const child = section[nested];
            if (!isSection(child)) continue;
            const allowed = Object.keys(childSchema.shape);
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
    // Other applications' settings may contain duplicate or incompatible keys: do not bind them.
    const roots = Object.entries(raw).filter(([key]) => key.toLowerCase() === 'cratis');
    if (roots.length > 1) throw new Error('Duplicate configuration key: Cratis');
    const cratis = roots[0]?.[1];
    if (cratis === undefined) return {};
    if (!isSection(cratis)) return { Cratis: cratis };
    const sections = Object.fromEntries(Object.entries(cratis).filter(([key]) =>
        ['arc', 'chronicle', 'mongodb'].includes(key.toLowerCase())));
    return normalize({ Cratis: sections }) as Section;
}
/** Read appsettings.json, its environment variant and double-underscore environment overrides (Node only). */
export function loadConfiguration(file: string | URL = 'appsettings.json', env: NodeJS.ProcessEnv = process.env,
    logger?: (error: unknown, correlationId: string) => void): CratisConfiguration {
    const path = file instanceof URL ? fileURLToPath(file) : file;
    const merged = readSettings(path);
    const environment = configurationEnvironment(env);
    if (environment && !/[/\\]/.test(environment)) {
        const environmentSettings = readSettings(join(dirname(path), `appsettings.${environment}.json`));
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
        const field = parts.at(-1)!;
        current[field] = field === 'resolverType' ? value.toLowerCase() : value;
    }
    merge(merged, overrides);
    warnUnknown(merged, logger);
    // Zod reports paths, never configuration values (which may contain credentials).
    const result = schema.safeParse(merged);
    if (!result.success) throw new Error(`Invalid Cratis configuration: ${result.error.issues.map(issue =>
        [...issue.path, issue.message === 'Invalid input' ? 'invalid value' : issue.message].join('.')).join('; ')}`);
    return result.data;
}
