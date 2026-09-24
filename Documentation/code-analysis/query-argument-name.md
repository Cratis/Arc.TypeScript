---
title: 'query-argument-name: Match a wire name to a local parameter'
description: Opt-in naming convention for Arc query arguments.
---

Arc binds query descriptors by position. A wire name may intentionally differ from the TypeScript parameter name. If your project prefers matching names, opt into `arc-core/query-argument-name` in the ESLint rules configuration. Neither preset enables this rule.

```js
{ rules: { 'arc-core/query-argument-name': 'warn' } }
```

The rule reports a literal `argument('wireName', Token)` whose name differs from the corresponding method parameter. It does not change runtime binding.
