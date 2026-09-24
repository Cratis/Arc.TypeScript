// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fileURLToPath } from 'node:url';

export function createConfig() {
    return {
        resolve: {
            alias: [
                { find: /^@cratis\/arc\.core\/hosting$/, replacement: fileURLToPath(new URL('./Source/Arc.Core/hosting.ts', import.meta.url)) },
                { find: /^@cratis\/arc\.core$/, replacement: fileURLToPath(new URL('./Source/Arc.Core/index.ts', import.meta.url)) },
                { find: /^@cratis\/arc\.testing$/, replacement: fileURLToPath(new URL('./Source/Testing/index.ts', import.meta.url)) }
            ]
        },
        test: {
            globals: true,
            environment: 'node',
            include: ['**/for_*/when_*/**/*.ts', '**/for_*/**/when_*.ts'],
            exclude: ['**/given/**', '**/dist/**', '**/node_modules/**'],
            setupFiles: fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))
        }
    };
}
