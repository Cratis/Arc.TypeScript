// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fileURLToPath } from 'node:url';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

const slices = fileURLToPath(new URL('../Features/', import.meta.url));

export default defineConfig({
    oxc: { decorator: { legacy: true } },
    resolve: { dedupe: ['react', 'react-dom', '@cratis/arc', '@cratis/arc.react', '@cratis/fundamentals', '@cratis/components'] },
    server: { port: 5173, strictPort: true, fs: { allow: [searchForWorkspaceRoot(process.cwd()), slices] }, proxy: {
        '/api': { target: 'http://127.0.0.1:3000' },
        '/.cratis': { target: 'http://127.0.0.1:3000', ws: true }
    } },
    build: {
        outDir: 'dist',
        rollupOptions: {
            output: {
                manualChunks(id) {
                    // Components' shared UI and form modules need their own chunks to stay below Vite's 500 kB warning threshold.
                    if (id.includes('/node_modules/@cratis/components/dist/esm/Common/')) return 'component-common';
                    if (id.includes('/node_modules/@cratis/components/dist/esm/CommandForm/')) return 'component-forms';
                    if (id.includes('/node_modules/@cratis/components/')) return 'components';
                    if (id.includes('/node_modules/allotment/')) return 'allotment';
                    if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'react';
                }
            }
        }
    }
});
