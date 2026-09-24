// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { argument, inject, query, rejected, service, type Outcome } from '@cratis/arc.core';
class Provider { fetch(): string { return ''; } }
class NarrowProvider extends Provider { narrow(): void {} }
class Samples {
    @inject(Provider)
    exact(provider: Provider): void { provider.fetch(); }
    @inject(Provider)
    optional(provider?: Provider): void { provider?.fetch(); }
    // @ts-expect-error injected Provider is not assignable to NarrowProvider
    @inject(Provider)
    narrow(provider: NarrowProvider): void { provider.narrow(); }
    // @ts-expect-error missing injected parameter
    @inject(Provider)
    missing(): void {}
    // @ts-expect-error unbound extra parameter
    @inject(Provider)
    extra(provider: Provider, extra: number): void { void provider; void extra; }
    @query(argument('ids', Array, { elementType: String }))
    static many(ids: string[]): string[] { return ids; }
    // @ts-expect-error array element is string, not number
    @query(argument('ids', Array, { elementType: String }))
    static wrongElements(ids: number[]): number[] { return ids; }
    @query(argument('id', String), service(Provider))
    static named(id: string, provider: Provider): string { return id + provider.fetch(); }
    // @ts-expect-error query descriptors are ordered; reversed arguments cannot compile
    @query(argument('id', String), service(Provider))
    static reversed(provider: Provider, id: string): string { return id + provider.fetch(); }
    // @ts-expect-error unbound query parameter
    @query(service(Provider))
    static unbound(provider: Provider, extra: number): void { void provider; void extra; }
}
class PreparedSample {
    provide(): string { return 'prepared'; }
    @inject(Provider)
    handle(value: string, provider: Provider): string { return value + provider.fetch(); }
    // @ts-expect-error preparation has type string, not number
    @inject(Provider)
    incompatible(value: number, provider: Provider): void { void value; void provider; }
}
class PreparedOutcomeSample {
    provide(): string | Outcome<never> {
        return rejected({ severity: 3, reason: 'rule', message: 'not ready', members: [] });
    }
    @inject(Provider)
    handle(value: string, provider: Provider): string { return value + provider.fetch(); }
    // @ts-expect-error handler must take the prepared value before injected services
    @inject(Provider)
    wrong(provider: Provider): void { provider.fetch(); }
}
void Samples;
void PreparedSample;
void PreparedOutcomeSample;
