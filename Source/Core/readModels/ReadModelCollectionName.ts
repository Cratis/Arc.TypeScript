// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Names the collection an Arc storage integration reads a read model class from, or returns undefined when the
 * integration does not read that class, so another integration must not rename where it is stored.
 */
export type ReadModelCollectionName = (type: new () => object) => string | undefined;
