// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

export function createConfig() {
    return {
        plugins: [{
            name: 'standard-decorators-esbuild',
            enforce: 'pre' as const,
            async transform(code: string, id: string) {
                const file = id.split('?', 1)[0] ?? id;
                if (!file.endsWith('.ts') || file.includes('/node_modules/')) return;
                return transform(code, { loader: 'ts', sourcefile: file, target: 'es2022', format: 'esm', sourcemap: true,
                    tsconfigRaw: { compilerOptions: { useDefineForClassFields: true, experimentalDecorators: false } } });
            }
        }],
        resolve: {
            alias: [
                { find: /^@cratis\/arc\.core\/hosting$/, replacement: fileURLToPath(new URL('./Source/Core/hosting.ts', import.meta.url)) },
                { find: /^@cratis\/arc\.core$/, replacement: fileURLToPath(new URL('./Source/Core/index.ts', import.meta.url)) },
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
