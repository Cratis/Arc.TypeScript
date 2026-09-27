// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { realpath } from 'node:fs/promises';
import { sep } from 'node:path';
import type { analyzeSource } from './analyzeSource.js';

/** Co-located output contains the artifact root or a discoverable, handwritten command or read model. */
export async function isColocatedOutput(artifacts: string, output: string,
    analysis: Pick<ReturnType<typeof analyzeSource>, 'artifactFiles'>): Promise<boolean> {
    const root = await realpath(artifacts);
    const destination = await realpath(output);
    if (root === destination || root.startsWith(destination + sep)) return true;
    if (!destination.startsWith(root + sep)) return false;
    return analysis.artifactFiles.some(path => path.startsWith(destination + sep));
}
