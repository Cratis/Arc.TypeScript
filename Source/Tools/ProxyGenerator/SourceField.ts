// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { SourceType } from './SourceType.js';
export interface SourceField { readonly name: string; readonly type: SourceType; readonly optional: boolean }
