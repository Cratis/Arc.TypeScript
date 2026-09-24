// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** Project fixture whose command depends on an erased TypeScript interface. */
export class an_invalid_project {
    root = join(dirname(fileURLToPath(import.meta.url)), 'invalid_project');
    project = join(this.root, 'tsconfig.json');
    artifacts = join(this.root, 'artifacts');
    output = join(this.root, 'generatedMetadata.ts');
}
