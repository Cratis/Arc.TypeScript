// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from './Authorization.js';
export interface DescriptorBase { name: string; namespace?: string; path?: string; summary?: string; authorization?: Authorization }
