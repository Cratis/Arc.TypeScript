// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readdir, realpath } from 'node:fs/promises';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { z } from 'zod';
import type { ArcServerOptions } from './ArcServerOptions.js';
import { ArcApplicationServices } from './ArcApplicationServices.js';
import { ArcApplication } from './ArcApplication.js';
import { ArcServer } from './ArcServer.js';
import type { CommandDefinition } from './commands/CommandDefinition.js';
import type { QueryDefinition } from './queries/QueryDefinition.js';
import type { ObservableQueryDefinition } from './queries/observable/ObservableQueryDefinition.js';
import { compileCommand } from './modelBound/compileCommand.js';
import { compileQueries } from './modelBound/compileQueries.js';
import { ownMetadata, type ClassType } from './modelBound/metadata.js';
import type { ServiceIdentifier } from './dependencyInjection/ServiceIdentifier.js';

interface Artifact { readonly type: ClassType; readonly namespace: string }
export class ArcApplicationBuilder {
    readonly services = new ArcApplicationServices();
    readonly #artifacts: Artifact[] = [];
    readonly #namespaces = new Map<ClassType, string>();
    constructor(private readonly options: ArcServerOptions = {}) {}
    add(...types: ClassType[]): this {
        for (const type of types) this.register(type, ownMetadata(type).namespace ?? '');
        return this;
    }
    private register(type: ClassType, namespace: string): void {
        const metadata = ownMetadata(type);
        if (!metadata.command && !metadata.readModel && !metadata.lifetime) return;
        const effective = metadata.namespace ?? namespace;
        const previous = this.#namespaces.get(type);
        if (previous !== undefined && previous !== effective) throw new Error(`Conflicting namespaces for ${type.name}: ${previous} and ${effective}`);
        if (previous !== undefined) return;
        this.#namespaces.set(type, effective);
        this.#artifacts.push({ type, namespace: effective });
    }
    async discover(root: URL, options: { rootNamespace?: string } = {}): Promise<this> {
        if (root.protocol !== 'file:') throw new Error('Arc discovery requires a file URL');
        const folder = await realpath(fileURLToPath(root));
        const bootstrap = process.argv[1] ? await realpath(process.argv[1]).catch(() => undefined) : undefined;
        if (bootstrap && (bootstrap === folder || bootstrap.startsWith(folder + sep)))
            throw new Error('Arc discovery cannot import the bootstrap folder');
        const files: string[] = [];
        const walk = async (directory: string): Promise<void> => {
            for (const entry of await readdir(directory, { withFileTypes: true })) {
                if (entry.isSymbolicLink()) continue;
                const path = join(directory, entry.name);
                if (entry.isDirectory()) {
                    if (!['dist', 'node_modules', 'given'].includes(entry.name) && !entry.name.startsWith('for_')) await walk(path);
                } else if (entry.isFile() && /\.(?:js|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts') &&
                    !/^index\.[jt]s$/.test(entry.name)) files.push(path);
            }
        };
        await walk(folder);
        files.sort();
        const seen = new Set(files.map(file => file.slice(0, -extname(file).length)));
        if (seen.size !== files.length || new Set(files.map(extname)).size > 1)
            throw new Error('Arc discovery cannot mix emitted JS and TS files');
        for (const file of files) {
            const module: Record<string, unknown> = await import(pathToFileURL(file).href);
            const namespace = [options.rootNamespace, ...relative(folder, dirname(file)).split(sep).filter(value => value && value !== '.')].filter(Boolean).join('.');
            for (const exported of Object.values(module)) {
                if (typeof exported === 'function') this.register(exported as ClassType, namespace);
            }
        }
        return this;
    }
    async build(): Promise<ArcApplication> {
        const commands: CommandDefinition<z.ZodType, unknown>[] = [...this.options.commands ?? []];
        const queries: QueryDefinition<z.ZodType, unknown>[] = [...this.options.queries ?? []];
        const observableQueries: ObservableQueryDefinition<z.ZodType, unknown>[] = [...this.options.observableQueries ?? []];
        const dependencies: ServiceIdentifier<unknown>[] = [];
        for (const { type, namespace } of this.#artifacts) {
            const metadata = ownMetadata(type);
            if (metadata.lifetime) this.services[metadata.lifetime === 'singleton' ? 'addSingleton' : metadata.lifetime === 'scoped' ? 'addScoped' : 'addTransient'](type);
            if (metadata.command) {
                const compiled = compileCommand(type, namespace);
                commands.push(compiled.definition);
                dependencies.push(...compiled.dependencies);
            }
            if (metadata.readModel) for (const compiled of compileQueries(type, namespace)) {
                if (compiled.observable) observableQueries.push(compiled.definition as ObservableQueryDefinition<z.ZodType, unknown>);
                else queries.push(compiled.definition as QueryDefinition<z.ZodType, unknown>);
                dependencies.push(...compiled.dependencies);
            }
        }
        if (this.options.services && !Array.isArray(this.options.services) && this.services.registrations.length)
            throw new Error('A supplied ServiceRegistry cannot be combined with builder service registrations');
        const registrations = [...Array.isArray(this.options.services) ? this.options.services : [], ...this.services.registrations];
        const server = new ArcServer({ ...this.options, commands, queries, observableQueries,
            services: this.options.services && !Array.isArray(this.options.services) ? this.options.services : registrations });
        try { server.services.preflight(dependencies); }
        catch (error) { await server.dispose(); throw error; }
        return new ArcApplication(server);
    }
}
