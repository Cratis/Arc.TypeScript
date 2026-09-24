// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Paging } from '@cratis/arc.server';
import type { Document, WithId } from 'mongodb';

/** A provider-owned page. Return it explicitly as application data; Arc Core does not render provider pages. */
export interface MongoPage<T extends Document> { readonly items: WithId<T>[]; readonly paging: Paging }
