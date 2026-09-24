// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** Source analysis fixture rooted in the repository's token-free Tasks sample. */
export class a_tasks_project {
    root = join(dirname(fileURLToPath(import.meta.url)), '../../../../../Samples/Tasks');
    project = join(this.root, 'tsconfig.json');
    artifacts = join(this.root, 'Features');
    output = join(this.artifacts, 'generatedMetadata.ts');
}
