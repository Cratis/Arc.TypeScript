// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { projects: ['./Source/*/vite.config.mts', './Source/Tools/*/vite.config.mts', './Samples/Tasks/vite.config.mts'] } });
