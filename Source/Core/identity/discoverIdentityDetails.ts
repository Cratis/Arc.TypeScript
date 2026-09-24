// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from '../reflection/ClassType.js';

const providers = new WeakSet<ClassType>();

/** Mark a details provider for artifact discovery; its schema and provide() are verified at build. */
export function identityDetailsProvider(): ClassDecorator {
    return target => { providers.add(target as unknown as ClassType); };
}

/** @internal */
export function isIdentityDetailsProvider(type: ClassType): boolean { return providers.has(type); }
