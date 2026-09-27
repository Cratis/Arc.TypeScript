// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readFile, realpath } from 'node:fs/promises';
import { sep } from 'node:path';
import { discoveryFiles } from '@cratis/arc.core';
import type ts from 'typescript';
import { metadataOwned, owned } from './generatedSourceOwnership.js';

/** Co-located output contains the artifact root or a discoverable, handwritten artifact source. */
export async function isColocatedOutput(artifacts: string, output: string, program: ts.Program): Promise<boolean> {
    const root = await realpath(artifacts);
    const destination = await realpath(output);
    if (root === destination || root.startsWith(destination + sep)) return true;
    if (!destination.startsWith(root + sep)) return false;
    for (const path of discoveryFiles(destination)) {
        const file = program.getSourceFile(path);
        if (!file || file.isDeclarationFile) continue;
        const text = await readFile(path, 'utf8');
        if (!owned(text) && !metadataOwned(text)) return true;
    }
    return false;
}
