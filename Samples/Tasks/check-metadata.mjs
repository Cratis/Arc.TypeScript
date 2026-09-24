// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [resolve(root, '../../Source/Tools/ProxyGenerator/dist/cli.js'),
    '--project', join(root, 'tsconfig.json'), '--artifacts', join(root, 'Features'),
    '--output', join(root, 'dist/proxies'), '--metadata', join(root, 'Features/generatedMetadata.ts'),
    '--check-metadata'], { stdio: 'inherit' });
