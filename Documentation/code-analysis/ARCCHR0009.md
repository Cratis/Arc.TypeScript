---
title: ARCCHR0009 — Secret-looking command field should not be audited
description: Mark command fields whose names read as secrets when Chronicle does not already mask them.
---

A command field such as `passphrase`, `privateKey`, or `authorizationHeader` may be recorded on the causation chain of every event the command appends. Mark the field `@notAudited()` from `@cratis/arc.chronicle` (or `@pii()` from `@cratis/chronicle/compliance` for personal data). The rule reports only decorated command fields with the unmasked words Passphrase, PrivateKey, AccessKey, Pin, Otp, Cvv, Cvc, SecurityCode, and AuthorizationHeader. It follows the .NET analyzer's whole-word naming heuristic, including pairs of adjacent camel-case words.

```ts
import { command } from '@cratis/arc.core';
import { notAudited } from '@cratis/arc.chronicle';

@command()
class Register {
    @notAudited() passphrase = '';
    handle() { /* ... */ }
}
```

Chronicle already withholds any name containing `password`, `secret`, `token`, `credential`, or `apiKey` (case-insensitive) at runtime. Reporting these would incorrectly claim they reach causation. The syntax-only rule cannot prove the type of every field or track computed fields and inherited fields; review those separately. This is an analog, not a complete data-flow analysis.
