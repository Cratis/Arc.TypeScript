// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
// The testing helper does not require consumers to install Mocha types.
export type ContextForSuite<TContext extends object> = (this: unknown, context: TContext) => void;

export function given<TContext extends object>(contextType: new (suite: unknown) => TContext, callback: ContextForSuite<TContext>) {
    return function (this: unknown) {
        const context = new contextType(this);
        callback.call(this, context);
    };
}
