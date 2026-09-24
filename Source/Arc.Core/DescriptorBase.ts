// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from './authorization/Authorization.js';
import type { ClientContract } from './introspection/ClientContract.js';
export interface DescriptorBase { name: string; namespace?: string; /** Route location when the qualified name includes a read model type. */ routeNamespace?: string; path?: string; summary?: string; authorization?: Authorization; clientOutput?: ClientContract }
