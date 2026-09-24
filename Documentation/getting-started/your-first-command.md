---
title: Your first command
description: Walk through the Tasks sample's concepts, command, validators, read model, bootstrap, and spec, and see what Arc does with each decorator.
---

The [Get started](index.md) page ran the Tasks sample from the outside. This page opens it up. You follow one task from the value types, through the command that registers it and the rules that guard it, to the read model that serves it and the spec that proves it. Every snippet is the sample's real code; the file links take you to the full source.

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

TypeScript erases the generic argument of `ConceptAs<T>` at runtime, so `static readonly valueType` tells Arc what the wire value is. On the wire, a `TaskId` is a UUID string; inside your handler it is a `TaskId`. [Concepts](../concepts.md) covers the supported value types.

## Declare the command

A command is a class. Its decorated fields are the input, and `handle()` is the work:

```typescript title="Features/Tasks/Registration/RegisterTask.ts"
import { field } from '@cratis/fundamentals';
import { command, inject } from '@cratis/arc.core';
import { TaskId } from '../TaskId.js';
import { TaskTitle } from '../TaskTitle.js';
import { Tasks } from '../Tasks.js';

@command()
export class RegisterTask {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @inject(Tasks)
    handle(tasks: Tasks): TaskId {
        tasks.register(this.id, this.title);
        return this.id;
    }
}
```

Here is what happens that you do not see. Arc reads the JSON body, checks it against the schema derived from the `@field` declarations, and turns the strings into a `TaskId` and a `TaskTitle` on a fresh `RegisterTask` instance. It opens a service scope, resolves `Tasks`, and calls `handle()`. The returned `TaskId` becomes the result's `response`, encoded back to a string.

`@inject(Tasks)` lists the service for each `handle()` parameter in order. TypeScript does not keep parameter types at runtime, so the token list is how Arc knows what to pass. [Dependency injection](../dependency-injection.md) explains the lifetimes.

The route comes from the folder: the sample discovers artifacts under `Features/`, so `Tasks/Registration/RegisterTask.ts` becomes `/api/tasks/registration/register-task`. [Endpoint mapping](../core/endpoint-mapping.md) shows how to keep a route stable when you move a file.

## Guard the input with rules

A title must not be blank. That is a business rule, so it goes in a validator next to the command:

```typescript title="Features/Tasks/Registration/RegisterTaskValidator.ts"
import { CommandValidator, validator } from '@cratis/arc.core';
import { RegisterTask } from './RegisterTask.js';

@validator(RegisterTask)
export class RegisterTaskValidator extends CommandValidator<RegisterTask> {
    constructor() {
        super();
        this.ruleFor(command => command.title).notEmpty().withMessage('A title is required');
        this.ruleFor(command => command.title).maxLength(100).withMessage('A title can have at most 100 characters');
    }
}
```

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

```typescript title="Features/Tasks/Listing/TaskItem.ts"
import { field } from '@cratis/fundamentals';
import { argument, query, readModel, service, type ObservableSource } from '@cratis/arc.core';
import { TaskId } from '../TaskId.js';
import { TaskTitle } from '../TaskTitle.js';
import { Tasks } from '../Tasks.js';

@readModel()
export class TaskItem {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @query(service(Tasks))
    static allTasks(tasks: Tasks): TaskItem[] { return tasks.all(); }

    @query(argument('id', TaskId), service(Tasks))
    static taskById(id: TaskId, tasks: Tasks): TaskItem | undefined { return tasks.byId(id); }

    @query({ observable: true }, service(Tasks))
    static observeAllTasks(tasks: Tasks): ObservableSource<TaskItem[]> { return tasks.observeAll(); }
}
```

Each `@query(...)` lists one descriptor per parameter, in order: `argument('id', TaskId)` binds the `id` query-string value, and `service(Tasks)` resolves a service. `observeAllTasks` returns a live source, so the same route answers a snapshot on GET and streams updates over server-sent events or WebSockets. The sample's in-memory [`Tasks`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Tasks.ts) service stands in for real storage. [Model-bound queries](../queries/model-bound/index.md) and [observable queries](../queries/observable-queries.md) go further.

## Wire it together

The entry point registers the service, discovers the decorated classes, and starts the host:

```typescript title="main.ts"
import { ArcApplication } from '@cratis/arc.core';
import { Tasks } from './Features/Tasks/Tasks.js';

const builder = ArcApplication.createBuilder({ development: true });
builder.services.addSingleton(Tasks);
await builder.discover(new URL('./Features/', import.meta.url));
export const app = await builder.build();
await app.run({ port: Number(process.env.PORT ?? 3000) });
```

`discover()` imports every exported class under `Features/` and picks up commands, read models, and validators by their decorators. `build()` checks the whole graph (every injected service registered, no lifetime mismatches, no misplaced decorators) before a listener opens. `development: true` returns exception details to callers; leave it off anywhere a real user can reach.

:::caution[The discovery folder must not contain the entry point]
`discover()` refuses a folder that contains the module currently calling it. Keep your artifacts in a dedicated folder such as `Features/`, as the sample does.
:::

## Prove it with a spec

The sample tests the command through the real pipeline without starting a server:

```typescript title="Features/Tasks/Registration/for_RegisterTask/given/a_task_registration.ts"
import { CommandScenario } from '@cratis/arc.testing';
import { Tasks } from '../../../Tasks.js';
import { RegisterTask } from '../../RegisterTask.js';
import { RegisterTaskValidator } from '../../RegisterTaskValidator.js';

export class a_task_registration {
    tasks = new Tasks();
    scenario = CommandScenario.for(RegisterTask, RegisterTaskValidator);

    constructor() { this.scenario.services.addSingleton(Tasks, this.tasks); }
}
```

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
        result.shouldHaveValidationErrors().shouldHaveValidationErrorFor('title');
    });
    it('should not invoke the handler', () => { context.tasks.all().should.have.lengthOf(0); });
}));
```

Run the sample's specs from the repository root with `yarn vitest run Samples/Tasks`. [Testing](../testing/index.md) covers commands, queries, and observable queries.

## Recap

A concept names a value, a command class carries the input and the work, validators hold the rules, a read model serves the data, and the builder wires them by convention. Arc owns the HTTP, the binding, the rule order, and the result envelope.

## Next steps

- [Commands](../commands/index.md) for command context, outcomes, and operations.
- [Queries](../queries/index.md) for arguments, paging, and live queries.
- [Coming from Express and NestJS](../coming-from-express-and-nestjs.md) if you want to compare this with the code you write today.
