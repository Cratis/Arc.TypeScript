// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { PreparedValue } from '../commands/modelBound/PreparedValue.js';
/** Typed standard and legacy method decorator signatures. */
export type MethodDecorator<T extends readonly unknown[], AllowsPreparation extends boolean = false> = {
    <This, Arguments extends unknown[], Result, Name extends string>(method: (this: This, ...arguments_: Arguments) => Result,
        context: ClassMethodDecoratorContext<This, (this: This, ...arguments_: Arguments) => Result> & { name: Name } &
            (AllowsPreparation extends true ? Name extends 'provide' ? T extends Arguments ? unknown : never :
                This extends { provide: (...arguments_: never[]) => infer Prepared } ?
                    [PreparedValue<Awaited<Prepared>>, ...T] extends Arguments ? unknown : never :
                    T extends Arguments ? unknown : never : T extends Arguments ? unknown : never)): void;
    (target: object, name: string | symbol, descriptor: PropertyDescriptor): void;
};
