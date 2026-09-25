// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { SQL } from 'drizzle-orm';
/** A typed SQL predicate authored by the application, not interpolated request text. */
export type DrizzleFilter = SQL | undefined;
