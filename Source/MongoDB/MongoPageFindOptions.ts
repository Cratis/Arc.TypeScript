// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Document, FindOptions } from 'mongodb';

/** Paged reads accept ordered field directions; MongoDB's other sort forms are not supported here. */
export type MongoPageFindOptions<T extends Document> = Omit<FindOptions<T>, 'sort' | 'skip' | 'limit'> & {
    sort?: Readonly<Record<string, 1 | -1>>;
};
