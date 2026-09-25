// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { query, readModel, service } from '@cratis/arc.core';
import type { Observable } from 'rxjs';
import { fromEvent } from '@cratis/chronicle/projections';
import { AuthorRegistered } from '../Registration/Registration.js';
import { AuthorId } from '../AuthorId.js';
import { AuthorName } from '../AuthorName.js';
import { Authors } from '../Authors.js';

@readModel()
@fromEvent(AuthorRegistered)
export class Author {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    @query({ observable: true }, service(Authors))
    static allAuthors(authors: Authors): Promise<Observable<Author[]>> {
        return authors.observeAll();
    }

    @query(service(Authors))
    static authorsPage(authors: Authors): Promise<Author[]> {
        return authors.all();
    }
}
