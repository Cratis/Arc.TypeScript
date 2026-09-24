// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { memberMetadata } from '../../reflection/memberMetadata.js';
import type { ClassType } from '../../reflection/ClassType.js';
import type { MethodDecorator } from '../../reflection/MethodDecorator.js';
import type { Parameter } from './Parameter.js';
import type { ParameterValues } from './ParameterValues.js';
import type { QueryHttpMethod } from './QueryHttpMethod.js';

/** Mark a public static read-model method as a query. */
export function query(): MethodDecorator<[], false, true>;
export function query<const Parameters extends readonly Parameter[]>(
    ...parameters: Parameters): MethodDecorator<ParameterValues<Parameters>>;
export function query<const Parameters extends readonly Parameter[]>(
    options: { observable?: boolean; argumentsModel?: ClassType; httpMethod?: QueryHttpMethod; treatWarningsAsErrors?: boolean },
    ...parameters: Parameters): MethodDecorator<ParameterValues<Parameters>>;
export function query(...declarations: readonly (Parameter | {
    observable?: boolean; argumentsModel?: ClassType; httpMethod?: QueryHttpMethod; treatWarningsAsErrors?: boolean
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
            observable: options.observable === true, observableExplicit: Object.hasOwn(options, 'observable'), argumentsModel: options.argumentsModel
        });
    }) as MethodDecorator<readonly unknown[]>;
}
