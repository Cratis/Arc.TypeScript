// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Paging } from './Paging.js';

export const emptyPaging = (): Paging => ({ page: 0, size: 0, totalItems: 0, totalPages: 0 });
