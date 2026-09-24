// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from './ClassType.js';
/** Discovered artifact and its folder-derived namespace. */
export interface Artifact { readonly type: ClassType; readonly namespace: string }
