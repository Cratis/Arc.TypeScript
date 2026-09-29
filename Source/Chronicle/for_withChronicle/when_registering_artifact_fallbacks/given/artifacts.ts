// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { singleton } from '@cratis/arc.core';
import { reactor } from '@cratis/chronicle/reactors';
import { reducer } from '@cratis/chronicle/reducers';

export class Dependency {}

export class FallbackState { count = 0; }

@reactor('arc-fallback-reactor')
export class FallbackReactor {
    static readonly inject = [Dependency];
    static constructed = 0;
    constructor(readonly dependency: Dependency) { FallbackReactor.constructed++; }
}

@reducer('arc-fallback-reducer', undefined, FallbackState)
export class FallbackReducer {
    static constructed = 0;
    constructor() { FallbackReducer.constructed++; }
}

@singleton()
@reactor('arc-decorated-reactor')
export class DecoratedReactor {}

@reactor('arc-unbindable-reactor')
export class UnbindableReactor {
    constructor(readonly value: unknown) {}
}
