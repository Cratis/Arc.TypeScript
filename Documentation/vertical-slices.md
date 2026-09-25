---
title: Keep a behavior together in a vertical slice
description: Put related commands, validators, events, and read-model queries in a single TypeScript slice file while keeping generated clients separate.
---

When you change how an author registers, you should not have to hunt through separate command, validator, and event folders. Keep the behavior in a slice folder, with one TypeScript file named for that behavior:

```text
Features/Authors/
├── AuthorId.ts
├── AuthorName.ts
├── Registration/
│   ├── Registration.ts
│   └── for_RegisterAuthor/when_registering/with_a_duplicate_name.ts
└── Listing/
    └── Listing.ts
```

[`Registration.ts`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Features/Authors/Registration/Registration.ts) exports `RegisterAuthor` and `RegisterAuthorValidator`. The validator refers directly to the command in the same file. [`Listing.ts`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Features/Authors/Listing/Listing.ts) exports the `Author` read model with its snapshot and observable queries. `AuthorId` and `AuthorName` live one level up because other slices use them. The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Registration/Registration.ts) follows the same layout.

This is an **application convention**, not a requirement of the Arc runtime. The [C# Library registration slice](https://github.com/Cratis/Samples/blob/main/Library/Lending/Authors/Registration/Registration.cs) puts `RegisterAuthor`, `AuthorRegistered`, and `UniqueAuthorName` in `Registration.cs`; [Studio's registration slice](https://github.com/Cratis/Studio/blob/main/Source/Core/Projects/Registration/Registration.cs) also keeps its command, constraint, and event together. In a Chronicle-only TypeScript slice, place its event alongside the command, give it a constructor and `@field` declarations, and return an event instance from `handle()`. Arc without Chronicle needs no event. The Library sample supports both backends through one command: it constructs `new AuthorRegistered(this.name)` and delegates the mode-specific write to `Authors`. That keeps its generated response stable, but is not the recommended event-return shape for a Chronicle-only application.

Discover the **folder**, not a single class: `await builder.discover(new URL('./Features/', import.meta.url))` registers every exported, decorated artifact in each module. The source proxy generator reads all exported command and read-model declarations in a file and still writes one browser proxy **per operation**. It also records each exported validator in generated metadata, including validators beside their commands; the sample's `generate-proxies` command regenerates both outputs. `yarn lint:tasks:arc` checks the co-located artifacts with the Arc ESLint plugin.

When you add a slice, run `yarn workspace @cratis/arc.core.sample.tasks generate-proxies`, `yarn check:metadata`, `yarn lint:tasks:arc`, and `yarn test:client-generation`. Do not hand-edit generated metadata or browser proxies. Framework implementations under `Source/` use one type per file instead; this layout is for application code and documentation examples.
