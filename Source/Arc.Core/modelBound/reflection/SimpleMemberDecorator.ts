// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Shared signature for legacy and standard method annotations. */
export type SimpleMemberDecorator = {
    (method: object, context: ClassMethodDecoratorContext): void;
    (target: object, name: string | symbol, descriptor: PropertyDescriptor): void;
};
