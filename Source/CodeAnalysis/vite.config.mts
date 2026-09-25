// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { defineConfig } from 'vitest/config';
import { createConfig } from '../../vite.base.js';

const base = createConfig();
export default defineConfig({
    ...base,
    test: {
        ...base.test,
        // Type-aware rule specs initialize a TypeScript program under shared-machine load.
        testTimeout: 30000,
        hookTimeout: 30000
    }
});
