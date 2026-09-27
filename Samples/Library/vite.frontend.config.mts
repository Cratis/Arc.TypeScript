// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { defineConfig } from 'vitest/config';
import { createConfig } from '../../vite.base.js';

const base = createConfig();
export default defineConfig({
    ...base,
    resolve: { ...base.resolve, dedupe: ['react', 'react-dom', '@cratis/arc', '@cratis/arc.react'] },
    test: { ...base.test, name: 'library-frontend', environment: 'jsdom', include: ['Features/**/for_*/when_*/*.tsx'] }
});
