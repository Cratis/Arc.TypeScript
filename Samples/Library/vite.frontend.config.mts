// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readFile } from 'node:fs/promises';
import { defineConfig } from 'vitest/config';
import { createConfig } from '../../vite.base.js';

const base = createConfig();
export default defineConfig({
    ...base,
    plugins: [...base.plugins, {
        name: 'components-without-missing-source-maps',
        enforce: 'pre',
        async load(id) {
            if (!/[/\\]node_modules[/\\]@cratis[/\\]components[/\\]dist[/\\]esm[/\\].+\.js$/.test(id)) return;
            // The published package maps point to source files not included in the package.
            return (await readFile(id, 'utf8')).replace(/^\/\/# sourceMappingURL=.*(?:\r?\n|$)/gm, '');
        }
    }],
    resolve: { ...base.resolve, dedupe: ['react', 'react-dom', '@cratis/arc', '@cratis/arc.react', '@cratis/components'] },
    test: { ...base.test, name: 'library-frontend', environment: 'jsdom', include: ['Features/**/for_*/when_*/*.tsx'],
        server: { deps: { inline: ['@cratis/components'] } } }
});
