// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from '../authorization/Authorization.js';
import type { ServiceClass, ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import type { ServiceToken } from '../dependencyInjection/ServiceToken.js';
import { memberMetadata, metadataFor, setClassAuthorization, setMemberAuthorization, type ClassType, type FieldOptions, type Parameter, type ParameterArgument, type ParameterService, type WireType } from './metadata.js';

type Value<T> = T extends StringConstructor ? string : T extends NumberConstructor ? number : T extends BooleanConstructor ? boolean : T extends ServiceClass<infer Instance> ? Instance : never;
type Injected<T extends readonly ServiceIdentifier<unknown>[]> = { -readonly [Index in keyof T]: T[Index] extends ServiceClass<infer Instance> ? Instance : T[Index] extends ServiceToken<infer Instance> ? Instance : never };
type ParameterValue<T extends Parameter> = T extends ParameterArgument ? T['optional'] extends true ? Value<T['type']> | undefined : Value<T['type']> : T extends ParameterService ? T['token'] extends ServiceClass<infer Instance> ? Instance : T['token'] extends ServiceToken<infer Instance> ? Instance : never : never;
type ParameterValues<T extends readonly Parameter[]> = { -readonly [Index in keyof T]: T[Index] extends Parameter ? ParameterValue<T[Index]> : never };
type MethodDecorator<T extends readonly unknown[], AllowsPreparation extends boolean = false> = {
    <This, Arguments extends unknown[], Result>(method: (this: This, ...arguments_: Arguments) => Result,
        context: ClassMethodDecoratorContext<This, (this: This, ...arguments_: Arguments) => Result> &
            (T extends Arguments ? unknown : AllowsPreparation extends true ?
                This extends { provide: (...arguments_: never[]) => infer Prepared } ?
                    [Awaited<Prepared>, ...T] extends Arguments ? unknown : never : never : never)): void;
    (target: object, name: string | symbol, descriptor: PropertyDescriptor): void;
};
type SimpleMemberDecorator = {
    (method: object, context: ClassMethodDecoratorContext): void;
    (target: object, name: string | symbol, descriptor: PropertyDescriptor): void;
};
type DualClassDecorator = (target: ClassType, context?: ClassDecoratorContext) => void;

export function command(options: { namespace?: string } = {}): DualClassDecorator {
    return target => { const data = metadataFor(target); data.command = true; data.namespace = options.namespace; };
}
export function readModel(options: { namespace?: string } = {}): DualClassDecorator {
    return target => { const data = metadataFor(target); data.readModel = true; data.namespace = options.namespace; };
}
export function argument<T extends WireType>(name: string, type: T): ParameterArgument & { readonly optional: false; readonly type: T };
export function argument<T extends WireType>(name: string, type: T, options: { optional: true }): ParameterArgument & { readonly optional: true; readonly type: T };
export function argument(name: string, type: WireType, options: { optional?: boolean } = {}): ParameterArgument {
    if (!name.trim()) throw new Error('Query argument name is required');
    return { kind: 'argument', name, type, optional: options.optional === true };
}
export function service<T extends ServiceClass<unknown>>(token: T): ParameterService & { readonly token: T };
export function service<T>(token: ServiceToken<T>): ParameterService & { readonly token: ServiceToken<T> };
export function service<T>(token: ServiceIdentifier<T>): ParameterService { return { kind: 'service', token }; }
export function inject<const Tokens extends readonly ServiceIdentifier<unknown>[]>(...tokens: Tokens): MethodDecorator<Injected<Tokens>, true> {
    return ((target: object, nameOrContext: string | symbol | ClassMethodDecoratorContext) => {
        const standard = typeof nameOrContext === 'object';
        const name = standard ? nameOrContext.name : nameOrContext;
        if (typeof name !== 'string' || standard && (nameOrContext.kind !== 'method' || nameOrContext.private || nameOrContext.static))
            throw new Error('@inject requires a public instance method');
        const data = memberMetadata(target, name, standard ? nameOrContext : undefined);
        data.injected = tokens;
        data.injectionDeclared = true;
    }) as MethodDecorator<Injected<Tokens>, true>;
}
export function query<const Parameters extends readonly Parameter[]>(...parameters: Parameters): MethodDecorator<ParameterValues<Parameters>>;
export function query<const Parameters extends readonly Parameter[]>(options: { observable?: boolean }, ...parameters: Parameters): MethodDecorator<ParameterValues<Parameters>>;
export function query(...declarations: readonly (Parameter | { observable?: boolean })[]): MethodDecorator<readonly unknown[]> {
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
        data.queryMethods.set(name, { parameters: parameters.length ? parameters : undefined, observable: options.observable === true });
    }) as MethodDecorator<readonly unknown[]>;
}
export function injectable(...tokens: readonly ServiceIdentifier<unknown>[]): DualClassDecorator {
    return target => { metadataFor(target).constructorTokens = tokens; };
}
function lifetime(value: 'singleton' | 'scoped' | 'transient'): DualClassDecorator {
    return target => { metadataFor(target).lifetime = value; };
}
export function singleton(): DualClassDecorator { return lifetime('singleton'); }
export function scoped(): DualClassDecorator { return lifetime('scoped'); }
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
export function roles(...names: string[]): DualClassDecorator & SimpleMemberDecorator {
    if (!names.length || names.some(name => !name.trim())) throw new Error('Roles must not be empty');
    return authorizationDecorator({ roles: names, authenticated: true });
}
export function authorize(): DualClassDecorator & SimpleMemberDecorator { return authorizationDecorator({ authenticated: true }); }
export function allowAnonymous(): DualClassDecorator & SimpleMemberDecorator { return authorizationDecorator({ anonymous: true }); }
export function route(path: string): DualClassDecorator & SimpleMemberDecorator {
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
        data.methodRoutes.set(name, path);
    }) as DualClassDecorator & SimpleMemberDecorator;
}
function fieldOption(option: FieldOptions): (target: object | undefined, nameOrContext: string | symbol | ClassFieldDecoratorContext) => void {
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
export function key(): ReturnType<typeof fieldOption> { return fieldOption({}); }
export function optional(): ReturnType<typeof fieldOption> { return fieldOption({ optional: true }); }
export function nullable(): ReturnType<typeof fieldOption> { return fieldOption({ nullable: true }); }
export function defaultValue(value: unknown): ReturnType<typeof fieldOption> { return fieldOption({ defaultValue: value }); }
export function enumeration(values: object): ReturnType<typeof fieldOption> {
    return fieldOption({ values: [...new Set(Object.values(values).filter(value => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))] });
}
