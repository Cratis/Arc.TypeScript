<!-- Copyright (c) Cratis. All rights reserved. Licensed under the MIT license. See LICENSE file in the project root for full license information. -->
# Tasks: the smallest Arc application

A model-bound command with validators, snapshot and observable queries, sorting and paging and a concept argument. It runs Arc for TypeScript on its own: no Chronicle, no database, no Docker. Storage is an in-memory service, for demonstration only.

## Run it

From the repository root (Node.js 22.19+ and Yarn 4):

```sh
Samples/Tasks/run.sh          # builds, then serves http://127.0.0.1:3000
Samples/Tasks/run.sh test     # slice layout, proxies, lint and specifications
```

```sh
curl -X POST http://127.0.0.1:3000/api/tasks/registration/register-task \
  -H 'content-type: application/json' -d '{"id":"9d4c2e8f-5c1f-4c8e-9b59-0a2f3c2f6a11","title":"Plan release"}'
curl 'http://127.0.0.1:3000/api/tasks/listing/all-tasks?sortBy=title&pageSize=10'
```

There is no dev mode because there is no UI. The port is `PORT` (default 3000).

## Follow the code

```text
Features/Tasks/
├── TaskId.ts, TaskTitle.ts, TaskTitleValidator.ts, Tasks.ts   shared by both slices
├── Registration/                                              RegisterTask, its validator, its proxy, its specs
└── Listing/                                                   TaskItem and its queries, proxies and specs
```

`Features/generatedMetadata.ts` and every `*.proxy.ts` are generated: `yarn workspace @cratis/arc.core.sample.tasks generate-proxies`.
