// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from '../authorization/Authorization.js';
import type { ServiceClass, ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import type { ServiceToken } from '../dependencyInjection/ServiceToken.js';
import {
    memberMetadata, metadataFor, setClassAuthorization, setMemberAuthorization,
    type ClassType, type FieldOptions, type Parameter, type ParameterArgument, type ParameterService, type WireType
} from '../reflection/metadata.js';
import type { Injected } from '../commands/modelBound/Injected.js';
import type { ParameterValues } from '../queries/modelBound/ParameterValues.js';
import type { MethodDecorator } from '../reflection/MethodDecorator.js';
import type { SimpleMemberDecorator } from '../reflection/SimpleMemberDecorator.js';
import type { DualClassDecorator } from '../reflection/DualClassDecorator.js';

/** Mark a class as a command with an optional stable namespace. */
export function command(options: { namespace?: string } = {}): DualClassDecorator {
    return target => { const data = metadataFor(target); data.command = true; data.namespace = options.namespace; };
}
/** Mark a class as a read model with static query methods. */
export function readModel(options: { namespace?: string } = {}): DualClassDecorator {
    return target => { const data = metadataFor(target); data.readModel = true; data.namespace = options.namespace; };
}
/** Bind a named query argument with its runtime wire type. */
export function argument<T extends WireType>(name: string, type: T): ParameterArgument & { readonly optional: false; readonly type: T };
export function argument<T extends WireType>(name: string, type: T,
    options: { optional: true }): ParameterArgument & { readonly optional: true; readonly type: T };
export function argument<T extends WireType, Element extends WireType>(name: string, type: T,
    options: { elementType: Element; optional?: false }): ParameterArgument & {
        readonly optional: false; readonly type: T; readonly element: Element
    };
export function argument<T extends WireType, Element extends WireType>(name: string, type: T,
    options: { elementType: Element; optional: true }): ParameterArgument & {
        readonly optional: true; readonly type: T; readonly element: Element
    };
export function argument(name: string, type: WireType, options: { optional?: boolean; elementType?: WireType } = {}): ParameterArgument {
    if (!name.trim()) throw new Error('Query argument name is required');
    return { kind: 'argument', name, type, optional: options.optional === true, element: options.elementType };
}
/** Resolve a service token in a query's execution scope. */
export function service<T extends ServiceClass<unknown>>(token: T): ParameterService & { readonly token: T };
export function service<T>(token: ServiceToken<T>): ParameterService & { readonly token: ServiceToken<T> };
export function service<T>(token: ServiceIdentifier<T>): ParameterService { return { kind: 'service', token }; }
/** Inject ordered services into a command's handle method. */
export function inject<const Tokens extends readonly ServiceIdentifier<unknown>[]>(
    ...tokens: Tokens): MethodDecorator<Injected<Tokens>, true> {
    return ((target: object, nameOrContext: string | symbol | ClassMethodDecoratorContext) => {
        const standard = typeof nameOrContext === 'object';
        const name = standard ? nameOrContext.name : nameOrContext;
        if (typeof name !== 'string' || standard && (nameOrContext.kind !== 'method' || nameOrContext.private || nameOrContext.static))
            throw new Error('@inject requires a public instance method');
        const data = memberMetadata(target, name, standard ? nameOrContext : undefined);
        data.injected = new Map(data.injected);
        if (data.injected.has(name)) throw new Error(`Duplicate @inject on ${name}`);
        data.injected.set(name, tokens);
    }) as MethodDecorator<Injected<Tokens>, true>;
}
/** Mark a public static read-model method as a query. */
export function query<const Parameters extends readonly Parameter[]>(
    ...parameters: Parameters): MethodDecorator<ParameterValues<Parameters>>;
export function query<const Parameters extends readonly Parameter[]>(
    options: { observable?: boolean; argumentsModel?: ClassType },
    ...parameters: Parameters): MethodDecorator<ParameterValues<Parameters>>;
export function query(...declarations: readonly (Parameter | {
    observable?: boolean; argumentsModel?: ClassType
})[]): MethodDecorator<readonly unknown[]> {
    const first = declarations[0];
    const options = first && !('kind' in first) ? first : {};
    const parameters = first && !('kind' in first) ? declarations.slice(1) as Parameter[] : declarations as Parameter[];
    return ((target: object, nameOrContext: string | symbol | ClassMethodDecoratorContext) => {
        const standard = typeof nameOrContext === 'object';
        const name = standard ? nameOrContext.name : nameOrContext;
        if (typeof name !== 'string' || standard && (nameOrContext.kind !== 'method' || nameOrContext.private || !nameOrContext.static))
            throw new Error('@query requires a public static method');
        const data = memberMetadata(target, name, standard ? nameOrContext : undefined);
        data.queryMethods = new Map(data.queryMethods);
        if (data.queryMethods.has(name)) throw new Error(`Duplicate query: ${name}`);
        data.queryMethods.set(name, {
            parameters: parameters.length ? parameters : undefined,
            observable: options.observable === true, argumentsModel: options.argumentsModel
        });
    }) as MethodDecorator<readonly unknown[]>;
}
/** Declare class constructor dependencies for service registration. */
export function injectable(...tokens: readonly ServiceIdentifier<unknown>[]): DualClassDecorator {
    return target => { metadataFor(target).constructorTokens = tokens; };
}
function lifetime(value: 'singleton' | 'scoped' | 'transient'): DualClassDecorator {
    return target => { metadataFor(target).lifetime = value; };
}
/** Register a discovered service once per application. */
export function singleton(): DualClassDecorator { return lifetime('singleton'); }
/** Register a discovered service once per execution scope. */
export function scoped(): DualClassDecorator { return lifetime('scoped'); }
/** Register a discovered service once per resolution. */
export function transient(): DualClassDecorator { return lifetime('transient'); }
function authorizationDecorator(value: Authorization): DualClassDecorator & SimpleMemberDecorator {
    return ((target: object, nameOrContext?: string | symbol | ClassMethodDecoratorContext | ClassDecoratorContext) => {
        if (nameOrContext === undefined || typeof nameOrContext === 'object' && nameOrContext.kind === 'class') {
            setClassAuthorization(target as ClassType, value);
            return;
        }
        const standard = typeof nameOrContext === 'object';
        const name = standard ? nameOrContext.name : nameOrContext;
        if (typeof name !== 'string') throw new Error('Authorization requires a named declaration');
        setMemberAuthorization(target, name, value, standard ? nameOrContext : undefined);
    }) as DualClassDecorator & SimpleMemberDecorator;
}
/** Require any role in this declaration and all other stacked declarations. */
export function roles(...names: string[]): DualClassDecorator & SimpleMemberDecorator {
    if (!names.length || names.some(name => !name.trim())) throw new Error('Roles must not be empty');
    return authorizationDecorator({ roles: names, authenticated: true });
}
/** Require an authenticated principal. */
export function authorize(): DualClassDecorator & SimpleMemberDecorator { return authorizationDecorator({ authenticated: true }); }
/** Allow anonymous access for this query or command declaration. */
export function allowAnonymous(): DualClassDecorator & SimpleMemberDecorator { return authorizationDecorator({ anonymous: true }); }
/** Override an endpoint's conventional path, like .NET's Path attribute. */
export function path(path: string): DualClassDecorator & SimpleMemberDecorator {
    return ((target: object, nameOrContext?: string | symbol | ClassMethodDecoratorContext | ClassDecoratorContext) => {
        if (nameOrContext === undefined || typeof nameOrContext === 'object' && nameOrContext.kind === 'class') {
            metadataFor(target).path = path;
            return;
        }
        const standard = typeof nameOrContext === 'object';
        const name = standard ? nameOrContext.name : nameOrContext;
        if (typeof name !== 'string') throw new Error('Route requires a named declaration');
        const data = memberMetadata(target, name, standard ? nameOrContext : undefined);
        data.methodRoutes = new Map(data.methodRoutes);
        if (data.methodRoutes.has(name)) throw new Error(`Duplicate @path on ${name}`);
        data.methodRoutes.set(name, path);
    }) as DualClassDecorator & SimpleMemberDecorator;
}
function fieldOption(option: FieldOptions): (
    target: object | undefined, nameOrContext: string | symbol | ClassFieldDecoratorContext) => void {
    return (target, nameOrContext) => {
        const standard = typeof nameOrContext === 'object';
        const name = standard ? nameOrContext.name : nameOrContext;
        if (typeof name !== 'string' || standard && (nameOrContext.kind !== 'field' || nameOrContext.static || nameOrContext.private))
            throw new Error('Field annotation requires a public instance field');
        const data = memberMetadata(target ?? {}, name, standard ? nameOrContext : undefined);
        data.fieldOptions = new Map(data.fieldOptions);
        data.fieldOptions.set(name, { ...data.fieldOptions.get(name), ...option });
    };
}
/** @experimental Reserved for storage integrations; has no effect on the current wire pipeline. */
export function key(): ReturnType<typeof fieldOption> { return fieldOption({}); }
/** Make a decorated field optional on input. */
export function optional(): ReturnType<typeof fieldOption> { return fieldOption({ optional: true }); }
/** Allow a decorated field to contain null. */
export function nullable(): ReturnType<typeof fieldOption> { return fieldOption({ nullable: true }); }
/** Supply an input default for a decorated field. */
export function defaultValue(value: unknown): ReturnType<typeof fieldOption> { return fieldOption({ defaultValue: value }); }
/** Restrict scalar wire values to the members of an enum object. */
export function enumeration(values: object): ReturnType<typeof fieldOption> {
    const entries = Object.entries(values as Record<string, unknown>);
    const members = entries.filter(([name, value]) => !(
        typeof value === 'string' && typeof (values as Record<string, unknown>)[value] === 'number' &&
        String((values as Record<string, unknown>)[value]) === name));
    return fieldOption({ values: [...new Set(members.map(([, value]) => value).filter(
        (value): value is string | number | boolean =>
            typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))] });
}
