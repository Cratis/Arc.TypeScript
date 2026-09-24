// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { argument, inject, query, rejected, service, CommandValidator, type Outcome } from '@cratis/arc.core';
import { ConceptAs } from '../../node_modules/@cratis/fundamentals/dist/esm/ConceptAs.js';
import { DateOnly } from '../../node_modules/@cratis/fundamentals/dist/esm/DateOnly.js';
import { Guid } from '../../node_modules/@cratis/fundamentals/dist/esm/Guid.js';
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
class Title extends ConceptAs<string> {}
class Count extends ConceptAs<number> {}
class ValidationSample { title!: Title; count!: Count; due!: DateOnly; id!: Guid; }
class SampleValidator extends CommandValidator<ValidationSample> {
    constructor() {
        super();
        this.ruleFor(value => value.title).must(title => title.length > 0).equal('valid').maxLength(12);
        this.ruleFor(value => value.count).greaterThan(0);
        this.ruleFor(value => value.due).greaterThan(DateOnly.parse('2024-01-01'));
        this.ruleFor(value => value.id).notEmpty().equal(Guid.empty);
        // @ts-expect-error concept rules take the primitive rather than the concept object
        this.ruleFor(value => value.title).must(title => title.value.length > 0);
        // @ts-expect-error equal uses the unwrapped string
        this.ruleFor(value => value.title).equal(new Title('invalid'));
        // @ts-expect-error string rules cannot run on numeric concepts
        this.ruleFor(value => value.count).maxLength(3);
        // @ts-expect-error comparison bounds must match the selected temporal value
        this.ruleFor(value => value.due).greaterThan(Date.now());
        // @ts-expect-error GUIDs do not support ordering rules
        this.ruleFor(value => value.id).lessThan(3);
        // @ts-expect-error string-only rules cannot run on temporal values
        this.ruleFor(value => value.due).emailAddress();
    }
}
void SampleValidator;
void Samples;
void PreparedSample;
void PreparedOutcomeSample;
