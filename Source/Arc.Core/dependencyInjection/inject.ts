// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { memberMetadata } from '../reflection/memberMetadata.js';
import type { Injected } from '../commands/modelBound/Injected.js';
import type { ProvidedToken } from '../commands/modelBound/provided.js';
import type { ServiceIdentifier } from './ServiceIdentifier.js';
import type { MethodDecorator } from '../reflection/MethodDecorator.js';

/** Inject ordered services into a command's handle method. */
export function inject<const Tokens extends readonly ServiceIdentifier<unknown>[]>(
    ...tokens: Tokens): MethodDecorator<Injected<Tokens>, Extract<Tokens[number], ProvidedToken<unknown>> extends never ? true : false> {
    return ((target: object, nameOrContext: string | symbol | ClassMethodDecoratorContext) => {
        const standard = typeof nameOrContext === 'object';
        const name = standard ? nameOrContext.name : nameOrContext;
        if (typeof name !== 'string' || standard && (nameOrContext.kind !== 'method' || nameOrContext.private || nameOrContext.static))
            throw new Error('@inject requires a public instance method');
        const data = memberMetadata(target, name, standard ? nameOrContext : undefined);
        data.injected = new Map(data.injected);
        if (data.injected.has(name)) throw new Error(`Duplicate @inject on ${name}`);
        data.injected.set(name, tokens);
    }) as MethodDecorator<Injected<Tokens>, Extract<Tokens[number], ProvidedToken<unknown>> extends never ? true : false>;
}
