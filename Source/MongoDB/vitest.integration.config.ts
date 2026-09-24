// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { defineConfig } from 'vitest/config';
import { createConfig } from '../../vite.base.js';

const config = createConfig();
export default defineConfig({ ...config, test: { ...config.test, include: ['Source/MongoDB/**/*.integration.ts'] } });
