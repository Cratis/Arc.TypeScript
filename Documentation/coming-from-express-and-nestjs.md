---
title: Coming from Express and NestJS
description: Map Express route handlers and NestJS controllers, DTOs, and class-validator rules to Arc commands, read models, and validators, and see what changes and when to stay where you are.
---

If you build Node.js backends today, you probably write one of two shapes: an Express route handler that parses, validates, and answers by hand, or a NestJS controller with DTO classes and `class-validator` decorators. Arc keeps the parts you like (classes, decorators, dependency injection) and removes the parts you repeat: the route, the parser, the status-code mapping, and the client that has to match all of it.

## An Express 5 route handler

```typescript title="Express 5"
import express from 'express';
import { z } from 'zod';

const tasks = new Map<string, string>();
const RegisterTask = z.object({ id: z.uuid(), title: z.string().min(1, 'A title is required') });

const app = express();
app.use(express.json());
app.post('/api/tasks/register', (request, response) => {
    const parsed = RegisterTask.safeParse(request.body);
    if (!parsed.success) {
        response.status(400).json({ errors: parsed.error.issues.map(issue => ({ path: issue.path, message: issue.message })) });
        return;
    }
    tasks.set(parsed.data.id, parsed.data.title);
    response.json({ id: parsed.data.id });
});
app.get('/api/tasks', (_request, response) => {
    response.json([...tasks].map(([id, title]) => ({ id, title })));
});
app.listen(3000, '127.0.0.1');
```

## A NestJS 11 controller

This is illustrative NestJS 11 code with `class-validator` and the global `ValidationPipe`:

```typescript title="NestJS 11 (illustrative)"
import { Body, Controller, Get, Injectable, Post } from '@nestjs/common';
import { IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class RegisterTaskDto {
    @IsUUID() id!: string;
    @IsNotEmpty({ message: 'A title is required' }) @MaxLength(100) title!: string;
}

@Injectable()
export class TasksService {
    readonly #items = new Map<string, string>();
    register(id: string, title: string): void { this.#items.set(id, title); }
    all() { return [...this.#items].map(([id, title]) => ({ id, title })); }
}

@Controller('api/tasks')
export class TasksController {
    constructor(private readonly tasks: TasksService) {}

    @Post('register')
    register(@Body() dto: RegisterTaskDto) {
        this.tasks.register(dto.id, dto.title);
        return { id: dto.id };
    }

    @Get()
    all() { return this.tasks.all(); }
}
```

## The same thing in Arc

The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/tree/main/Samples/Tasks/Features/Tasks) splits it by what each piece does:

```typescript title="Arc for TypeScript"
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

@validator(RegisterTask)
export class RegisterTaskValidator extends CommandValidator<RegisterTask> {
    constructor() {
        super();
        this.ruleFor(command => command.title).notEmpty().withMessage('A title is required');
        this.ruleFor(command => command.title).maxLength(100).withMessage('A title can have at most 100 characters');
    }
}

@readModel()
export class TaskItem {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @query(service(Tasks))
    static allTasks(tasks: Tasks): TaskItem[] { return tasks.all(); }
}
```

The imports and the `TaskId`, `TaskTitle`, and `Tasks` types are in the linked sample; [Your first command](getting-started/your-first-command.md) shows every file.

## What changed and why

| You wrote | Arc gives you |
| --- | --- |
| A route string per endpoint | Routes derived from folders and names, [overridable](core/endpoint-mapping.md) with `@path` |
| `express.json()` and `safeParse`, or `@Body()` and `ValidationPipe` | Binding from `@field` declarations; the wrong shape is a 400 `malformedRequest` before your code runs |
| Your own error JSON | The Arc result envelope with `validationResults`, the same for every endpoint, which the `@cratis/arc` client understands |
| `class-validator` decorators on the DTO | A `CommandValidator` beside the command, plus `ConceptValidator` rules that follow a value everywhere |
| A separate "validate only" endpoint, if any | `POST <route>/validate` for every command |
| NestJS guards | [`@roles`, `@authorize`, policies](authorizing-commands-and-queries.md), checked before validation so denied callers never see rule messages |
| NestJS providers and constructor injection | [Arc services](dependency-injection.md) with explicit tokens, and a build that rejects missing registrations and captive lifetimes |
| Hand-written frontend `fetch` calls and types | [Generated proxies](proxy-generation/index.md) with the same routes and the client-safe validation rules |
| Polling or a custom WebSocket for live lists | [Observable queries](queries/observable-queries.md) on the same route |

The biggest shift is the split between **commands** that change state and **read models** that serve it. Arc is a CQRS framework: the command does not return the list, and the query does not change anything. You do not have to adopt event sourcing to get that split.

Arc does not replace your web framework. You can [mount Arc in Express, Fastify, or Hono](hosts/index.md) and keep your existing routes, health checks, and middleware beside it.

## When to stay where you are

- **You need what NestJS's module system gives you**: GraphQL resolvers, microservice transports, a large plugin ecosystem, or a team already fluent in it. Arc covers commands, queries, and live queries over HTTP, not those.
- **You need production stability now.** Arc for TypeScript is a source preview: nothing is published to npm, and it does not have full parity with Arc on .NET. Check the [capability reference](reference/capabilities.md).
- **Your endpoints are not command- or query-shaped**, such as file uploads, webhooks with fixed external contracts, or streaming downloads. Keep those as ordinary routes next to Arc.

## Related

- [Get started](getting-started/index.md)
- [Hosting overview](overview.md)
