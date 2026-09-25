---
title: Your first command
description: Walk through the Tasks sample's concepts, command, validators, read model, bootstrap, and spec, and see what Arc does with each decorator.
---

The [Get started](index.md) page ran the Tasks sample from the outside: a command stored a task, a rule refused an empty title, and a query served the result. None of that needed a route, a body parser, or an error mapper. This page opens the sample up so you can see which few lines produced each behavior.

You follow one task from its value types, through the command that registers it and the rules that guard it, to the read model that serves it and the spec that proves it. Every snippet is the sample's real code; the file links take you to the full source.

## Name the values first

A task ID should not look like every other string. The sample wraps each domain value in a Fundamentals concept:

```typescript title="Features/Tasks/TaskId.ts"
import { ConceptAs, Guid } from '@cratis/fundamentals';

export class TaskId extends ConceptAs<Guid> {
    static readonly valueType = Guid;
    static create(): TaskId { return new TaskId(Guid.create()); }
}
```

```typescript title="Features/Tasks/TaskTitle.ts"
import { ConceptAs } from '@cratis/fundamentals';

export class TaskTitle extends ConceptAs<string> { static readonly valueType = String; }
```

Why bother? A handler that takes `(id: string, title: string)` accepts the arguments in either order and compiles. A handler that takes a `TaskId` and a `TaskTitle` does not.

TypeScript erases the generic argument of `ConceptAs<T>` at runtime, so `static readonly valueType` tells Arc what the wire value is. On the wire, a `TaskId` is a UUID string; inside your handler it is a `TaskId`. Arc converts in both directions, and a string that is not a UUID is rejected as a malformed request before your code sees it. [Concepts](../concepts.md) covers the supported value types.

## Declare the command

A command is a class. Its decorated fields are the input, and `handle()` is the work:

```typescript title="Features/Tasks/Registration/Registration.ts"
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, validator } from '@cratis/arc.core';
import { TaskId } from '../TaskId.js';
import { TaskTitle } from '../TaskTitle.js';
import { Tasks } from '../Tasks.js';

@command()
export class RegisterTask {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    handle(tasks: Tasks): TaskId {
        tasks.register(this.id, this.title);
        return this.id;
    }
}

@validator(RegisterTask)
export class RegisterTaskValidator extends CommandValidator<RegisterTask> {
    constructor() {
        super();
        this.ruleFor(command => command.title).notEmpty().withMessage('A title is required');
        this.ruleFor(command => command.title).maxLength(100).withMessage('A title can have at most 100 characters');
    }
}
```

Here is what happens that you do not see. Arc reads the JSON body, checks it against the schema derived from the `@field` declarations, and turns the strings into a `TaskId` and a `TaskTitle` on a fresh `RegisterTask` instance. It opens a service scope, resolves `Tasks`, and calls `handle()`. The returned `TaskId` becomes the result's `response`, encoded back to a string.

Generated metadata lists the `Tasks` service for `handle()`: TypeScript does not keep parameter types at runtime. Without generated metadata, mark the method with `@inject(Tasks)`. [Dependency injection](../dependency-injection.md) explains the lifetimes.

The route comes from the folder: the sample discovers artifacts under `Features/`, so `Tasks/Registration/Registration.ts` becomes `/api/tasks/registration/register-task`. [Endpoint mapping](../core/endpoint-mapping.md) shows how to keep a route stable when you move a file.

## Guard the input with rules

A title must not be blank. The `RegisterTaskValidator` above lives in the **same** `Registration.ts` as its command. That is the [vertical slice convention](../vertical-slices.md), not a requirement that Arc puts on TypeScript files.

A rule that belongs to the value itself, wherever it appears, goes on the concept:

```typescript title="Features/Tasks/TaskTitleValidator.ts"
import { ConceptValidator, validator } from '@cratis/arc.core';
import { TaskTitle } from './TaskTitle.js';

@validator(TaskTitle)
export class TaskTitleValidator extends ConceptValidator<TaskTitle> {
    constructor() {
        super();
        this.ruleFor(title => title.value).must(value => !value.startsWith('!'))
            .withMessage('A title cannot begin with an exclamation mark');
    }
}
```

Arc runs both before `handle()`, and on the `/validate` route. Send `"title":"!Loud"` to the validation route and the answer is 400 with `A title cannot begin with an exclamation mark` for the member `title`. [Command validation](../commands/command-validation.md) lists the rules you can use.

## Serve the data with a read model

Queries live on a read model as static methods:

```typescript title="Features/Tasks/Listing/Listing.ts"
import { field } from '@cratis/fundamentals';
import { query, readModel, service } from '@cratis/arc.core';
import type { BehaviorSubject } from 'rxjs';
import { TaskId } from '../TaskId.js';
import { TaskTitle } from '../TaskTitle.js';
import { Tasks } from '../Tasks.js';

@readModel()
export class TaskItem {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @query(service(Tasks))
    static allTasks(tasks: Tasks): TaskItem[] { return tasks.all(); }

    @query()
    static taskById(id: TaskId, tasks: Tasks): TaskItem | undefined { return tasks.byId(id); }

    @query()
    static observeAllTasks(tasks: Tasks): BehaviorSubject<TaskItem[]> { return tasks.observeAll(); }
}
```

Generated metadata binds `id` from the query string and `Tasks` from the service scope. Without generated metadata, list `argument('id', TaskId)` and `service(Tasks)` in parameter order on `@query(...)`. `observeAllTasks` returns a live source, so the same route answers a snapshot on GET and streams updates over server-sent events or WebSockets. The sample's in-memory [`Tasks`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Tasks.ts) service stands in for real storage. [Model-bound queries](../queries/model-bound/index.md) and [observable queries](../queries/observable-queries.md) go further.

## Wire it together

The [Tasks entry point](index.md#see-what-started-the-server) registers the service, installs generated metadata, discovers the decorated classes, and starts the host. Keep that single bootstrap alongside the sample instead of copying it into another application.

`discover()` imports every exported class under `Features/` and picks up commands, read models, and validators by their decorators. `build()` checks the whole graph (every injected service registered, no lifetime mismatches, no misplaced decorators) before a listener opens. The sample binds `Cratis:Arc:Development` to enable development discovery. Exception details instead follow `Cratis:Arc:ExposeExceptionDetails`, which defaults on only in a Development environment; keep it off on public hosts.

:::caution[The discovery folder must not contain the entry point]
`discover()` refuses a folder that contains the module currently calling it. Keep your artifacts in a dedicated folder such as `Features/`, as the sample does.
:::

## Prove it with a spec

The sample tests the command through the real pipeline without starting a server:

```typescript title="Features/Tasks/Registration/for_RegisterTask/given/a_task_registration.ts"
import { CommandScenario } from '@cratis/arc.testing';
import { Tasks } from '../../../Tasks.js';
import { RegisterTask, RegisterTaskValidator } from '../../Registration.js';
import { metadata } from '../../../../generatedMetadata.js';

export class a_task_registration {
    tasks = new Tasks();
    scenario = CommandScenario.for(RegisterTask, RegisterTaskValidator);

    constructor() {
        this.scenario.extend(builder => builder.useGeneratedMetadata(metadata));
        this.scenario.services.addSingleton(Tasks, this.tasks);
    }
}
```

The context builds the same kind of application `main.ts` builds, minus the listener: the generated metadata, the command and its validator, and a `Tasks` instance the spec can inspect afterward.

```typescript title="Features/Tasks/Registration/for_RegisterTask/when_validating/with_an_empty_title.ts"
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { TaskId } from '../../../TaskId.js';
import { TaskTitle } from '../../../TaskTitle.js';
import { a_task_registration } from '../given/a_task_registration.js';

describe('when validating a task with an empty title', given(a_task_registration, context => {
    let result: ScenarioCommandResult;
    beforeEach(async () => {
        result = await context.scenario.validate({ id: TaskId.create(), title: new TaskTitle('') });
    });
    afterAll(async () => { await context.scenario.dispose(); });
    it('should report the authored rule for title', () => {
        result.shouldHaveValidationErrors().shouldHaveValidationErrorForMember('title');
    });
    it('should not invoke the handler', () => { context.tasks.all().should.have.lengthOf(0); });
}));
```

`validate()` sends the values through the same authorization and validation the `/validate` route runs, then stops. The first assertion proves that an authored rule failed for the `title` member; the second proves that `handle()` never stored anything. Together they pin the behavior you saw with `curl`: the rule, the field, and the untouched store.

:::caution[Assert on the member, not a word in the message]
`shouldHaveValidationErrorFor(text)` matches a *message fragment*. `shouldHaveValidationErrorFor('title')` passes only because "A title is required" happens to contain the word, and it keeps passing if a different rule with "title" in its message fails instead. Use `shouldHaveValidationErrorForMember('title')` to assert the field, and pass the full message to `shouldHaveValidationErrorFor` when the wording matters.
:::

Run the sample's specs from the repository root:

```bash
yarn vitest run Samples/Tasks
```

Vitest runs the sample's command and query specs, and every test passes. [Testing](../testing/index.md) covers commands, queries, and observable queries.

## Recap

A concept names a value, a command class carries the input and the work, validators hold the rules, a read model serves the data, and the builder wires them by convention. Arc owns the HTTP, the binding, the rule order, and the result envelope.

## Next step

The server works; now give it a user interface. [Continue in the browser](continue-in-the-browser.md) generates a typed client from these same classes and calls the server from a small React page.

When you want to go deeper:

- [Commands](../commands/index.md) for command context, outcomes, and operations.
- [Queries](../queries/index.md) for arguments, paging, and live queries.
- [Coming from Express and NestJS](../coming-from-express-and-nestjs.md) if you want to compare this with the code you write today.
