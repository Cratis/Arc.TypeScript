// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { defineConfig } from 'vitest/config';
import { createConfig } from '../../../vite.base.js';
const base = createConfig();
export default defineConfig({
    ...base,
    test: {
        ...base.test,
        // Specs build real TypeScript compiler programs that take seconds; this is compiler cost, not a timing race.
        testTimeout: 30000,
        hookTimeout: 60000
    }
});
