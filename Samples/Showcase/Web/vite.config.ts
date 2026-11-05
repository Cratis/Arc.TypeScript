// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fileURLToPath } from 'node:url';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

const slices = fileURLToPath(new URL('../Features/', import.meta.url));
const server = process.env.SHOWCASE_SERVER ?? 'http://127.0.0.1:3002';

export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    oxc: { decorator: { legacy: true } },
    resolve: { dedupe: ['react', 'react-dom', '@cratis/arc', '@cratis/arc.react', '@cratis/fundamentals'] },
    server: { port: 5174, strictPort: true, fs: { allow: [searchForWorkspaceRoot(process.cwd()), slices] }, proxy: {
        '/api': { target: server },
        '/showcase': { target: server },
        '/.cratis': { target: server, ws: true }
    } },
    build: { outDir: 'dist', emptyOutDir: true }
});
