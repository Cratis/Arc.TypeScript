---
title: Query validation
description: Validate a query's arguments together with an arguments model and QueryValidator, and know how concept rules apply without one.
---

A search needs a non-empty term, and some rules only make sense across arguments together. Give the query an **arguments model** and a `QueryValidator` for it. Arc runs the validator before the query method, and answers 400 with the rule messages when it fails.

## Validate arguments together

This excerpt comes from Arc's own [validation specs](https://github.com/Cratis/Arc.TypeScript/tree/main/Source/Core/validation/for_ModelGraphValidator/given), with the imports rewritten to the package:

```typescript
import { ConceptAs, field } from '@cratis/fundamentals';
import { QueryValidator, argument, query, readModel, validator } from '@cratis/arc.core';

export class Name extends ConceptAs<string> { static readonly valueType = String; }

export class SearchArguments {
    @field(Name) term!: Name;
}

@validator(SearchArguments)
export class SearchArgumentsValidator extends QueryValidator<SearchArguments> {
    constructor() {
        super();
        this.ruleFor(arguments_ => arguments_.term).notEmpty().withMessage('Term required');
    }
}

@readModel()
export class Search {
    @query({ argumentsModel: SearchArguments }, argument('term', Name))
    static byTerm(term: Name): string { return term.value; }
}
```

The arguments model's `@field` declarations must match the query's `argument(...)` descriptors. Add or discover the validator with the read model, as for command validators. The query model validator runs once, then Arc visits its fields for [concept validators](../concepts.md#validate-a-concept-everywhere).

## Without an arguments model

Arc still validates each supplied, non-null argument's concept graph under that argument's name. A `QueryValidator` needs an explicit arguments model to target.

## Differences from command validation

- Queries always use `Warning` as the allowed severity; `X-Allowed-Severity` is ignored. See [Validation severity filtering](../commands/validation-severity-filtering.md).
- Literal, unconditional client-safe rules on an arguments model are emitted into [generated proxies](../proxy-generation/validation.md).
- Low-level `defineQuery` definitions use `validate` and `filters` with the `QueryFilter` type; see [Command filters](../commands/command-filters.md).

The rule vocabulary, conditions, services, and asynchronous rules are the same as for [command validation](../commands/command-validation.md#rule-vocabulary).

## Related

- [Query pipeline](query-pipeline.md)
- [Query arguments](model-bound/query-arguments.md)
