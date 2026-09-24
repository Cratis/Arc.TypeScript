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
import { compileCommand } from './modelBound/commands/compileCommand.js';
import { compileQueries } from './modelBound/queries/compileQueries.js';
import { ownMetadata, type ClassType } from './modelBound/reflection/metadata.js';
import type { Artifact } from './modelBound/reflection/Artifact.js';
import { validateMetadata } from './modelBound/reflection/validateMetadata.js';
import type { ServiceIdentifier } from './dependencyInjection/ServiceIdentifier.js';
import { BaseValidator } from './validation/BaseValidator.js';
import { ModelGraphValidator } from './validation/ModelGraphValidator.js';

/** Collect decorated artifacts and their services into one executable application. */
export class ArcApplicationBuilder {
    readonly services = new ArcApplicationServices();
    readonly #artifacts: Artifact[] = [];
    #built = false;
    readonly #namespaces = new Map<ClassType, string>();
    constructor(private readonly options: ArcServerOptions = {}) {}
    /** Add explicitly named decorated artifacts; reject undecorated classes. */
    add(...types: ClassType[]): this {
        for (const type of types) {
            const metadata = ownMetadata(type);
            if (!metadata.command && !metadata.readModel && !metadata.lifetime && !metadata.validatorTarget) {
                throw new Error(`Not an Arc artifact: ${type.name}`);
            }
            this.register(type, metadata.namespace ?? '');
        }
        return this;
    }
    private register(type: ClassType, namespace: string): void {
        const metadata = ownMetadata(type);
        if (!metadata.command && !metadata.readModel && !metadata.lifetime && !metadata.validatorTarget) return;
        const effective = metadata.namespace ?? namespace;
        const previous = this.#namespaces.get(type);
        if (previous !== undefined && previous !== effective) throw new Error(`Conflicting namespaces for ${type.name}: ${previous} and ${effective}`);
        if (previous !== undefined) return;
        this.#namespaces.set(type, effective);
        this.#artifacts.push({ type, namespace: effective });
    }
    /** Import decorated artifacts beneath a dedicated discovery root. */
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
    /** Compile artifacts and preflight their declared dependencies. */
    async build(): Promise<ArcApplication> {
        if (this.#built) throw new Error('Arc application builder can be built only once');
        this.#built = true;
        if (this.options.services && !Array.isArray(this.options.services) &&
            (this.services.registrations.length || this.#artifacts.some(({ type }) => {
                const metadata = ownMetadata(type);
                return metadata.lifetime || metadata.validatorTarget;
            }))) throw new Error('Decorated lifetimes and builder registrations require builder-owned services');
        const commands: CommandDefinition<z.ZodType, unknown>[] = [...this.options.commands ?? []];
        const queries: QueryDefinition<z.ZodType, unknown>[] = [...this.options.queries ?? []];
        const observableQueries: ObservableQueryDefinition<z.ZodType, unknown>[] = [...this.options.observableQueries ?? []];
        const dependencies: ServiceIdentifier<unknown>[] = [];
        const validatorTypes = new Map<ClassType, ClassType<BaseValidator<unknown>>>();
        for (const { type } of this.#artifacts) {
            validateMetadata(type);
            const target = ownMetadata(type).validatorTarget;
            if (!target) continue;
            if (validatorTypes.has(target)) throw new Error(`Duplicate validator target: ${target.name}`);
            validatorTypes.set(target, type as ClassType<BaseValidator<unknown>>);
            const lifetime = ownMetadata(type).lifetime;
            if (lifetime === 'singleton') throw new Error(`Validator ${type.name} must not be singleton`);
            const existing = [...Array.isArray(this.options.services) ? this.options.services : [], ...this.services.registrations]
                .find(registration => registration.token === type);
            if (existing?.lifetime === 'singleton') throw new Error(`Validator ${type.name} must not be singleton`);
            if (!existing) this.services[lifetime === 'scoped' ? 'addScoped' : 'addTransient'](type);
            dependencies.push(type);
        }
        const graph = new ModelGraphValidator(validatorTypes, this.options.logger);
        for (const { type, namespace } of this.#artifacts) {
            const metadata = ownMetadata(type);
            if (metadata.lifetime && !metadata.validatorTarget) this.services[metadata.lifetime === 'singleton' ? 'addSingleton' : metadata.lifetime === 'scoped' ? 'addScoped' : 'addTransient'](type);
            if (metadata.command) {
                const compiled = compileCommand(type, namespace, graph);
                commands.push(compiled.definition);
                dependencies.push(...compiled.dependencies);
            }
            if (metadata.readModel) for (const compiled of compileQueries(type, namespace, graph)) {
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
