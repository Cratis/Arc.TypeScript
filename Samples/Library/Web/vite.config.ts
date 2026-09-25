// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { defineConfig } from 'vite';

export default defineConfig({
    server: { port: 5173, strictPort: true, proxy: {
        '/api': { target: 'http://127.0.0.1:3000' },
        '/.cratis': { target: 'http://127.0.0.1:3000', ws: true }
    } },
    build: { outDir: 'dist' }
});
