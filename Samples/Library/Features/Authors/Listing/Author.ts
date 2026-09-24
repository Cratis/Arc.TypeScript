// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { query, readModel, service, type ObservableSource } from '@cratis/arc.core';
import { AuthorId } from '../AuthorId.js';
import { AuthorName } from '../AuthorName.js';
import { Authors } from '../Authors.js';

@readModel()
export class Author {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    @query({ observable: true }, service(Authors))
    static allAuthors(authors: Authors): Promise<ObservableSource<Author[]>> {
        return authors.observeAll();
    }

    @query(service(Authors))
    static authorsPage(authors: Authors): Promise<Author[]> {
        return authors.all();
    }
}
