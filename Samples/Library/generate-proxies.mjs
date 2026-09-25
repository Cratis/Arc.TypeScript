// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import process from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(root, 'Web/src/generated'), { recursive: true });
execFileSync(process.execPath, [join(root, '../../Source/Tools/ProxyGenerator/dist/cli.js'),
    '--project', join(root, 'tsconfig.json'), '--artifacts', join(root, 'Features'),
    '--output', join(root, 'Web/src/generated'), '--metadata', join(root, 'Features/generatedMetadata.ts'),
    '--use-proxy-file-suffix'], { stdio: 'inherit' });
