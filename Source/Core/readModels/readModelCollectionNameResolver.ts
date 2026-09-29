// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { serviceToken } from '../dependencyInjection/ServiceToken.js';
import type { ReadModelCollectionName } from './ReadModelCollectionName.js';

/**
 * Registered by a storage integration such as `withMongoDB` so other integrations, such as Chronicle, can store a
 * read model in the collection the application reads it from. Absent when no such integration is configured.
 */
export const readModelCollectionNameResolver = serviceToken<ReadModelCollectionName>('ReadModelCollectionNameResolver');
