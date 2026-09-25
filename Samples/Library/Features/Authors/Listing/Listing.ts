// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { query, readModel, service } from '@cratis/arc.core';
import { ChronicleReadModels } from '@cratis/arc.chronicle';
import type { Observable } from 'rxjs';
import { fromEvent } from '@cratis/chronicle/projections';
import { AuthorRegistered } from '../Registration/Registration.js';
import { AuthorId } from '../AuthorId.js';
import { AuthorName } from '../AuthorName.js';
import { observeProjected } from '../../observeProjected.js';

@readModel()
@fromEvent(AuthorRegistered)
export class Author {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    @query({ observable: true }, service(ChronicleReadModels))
    static allAuthors(models: ChronicleReadModels): Observable<Author[]> {
        return observeProjected(models, Author, author => author.id.toString());
    }

    @query(service(ChronicleReadModels))
    static async authorsPage(models: ChronicleReadModels): Promise<Author[]> {
        return (await models.getStore()).readModels.getInstances(Author);
    }
}
