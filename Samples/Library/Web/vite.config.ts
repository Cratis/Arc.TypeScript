// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fileURLToPath } from 'node:url';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

const slices = fileURLToPath(new URL('../Features/', import.meta.url));

export default defineConfig({
    oxc: { decorator: { legacy: true } },
    resolve: { dedupe: ['react', 'react-dom', '@cratis/arc', '@cratis/arc.react', '@cratis/components'] },
    server: { port: 5173, strictPort: true, fs: { allow: [searchForWorkspaceRoot(process.cwd()), slices] }, proxy: {
        '/api': { target: 'http://127.0.0.1:3000' },
        '/.cratis': { target: 'http://127.0.0.1:3000', ws: true }
    } },
    build: { outDir: 'dist' }
});
