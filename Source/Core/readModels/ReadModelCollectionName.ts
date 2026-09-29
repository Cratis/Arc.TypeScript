// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Names the collection an Arc storage integration reads a read model class from. */
export type ReadModelCollectionName = (type: new () => object) => string;
