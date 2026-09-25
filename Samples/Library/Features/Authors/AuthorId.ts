// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, Guid } from '@cratis/fundamentals';

export class AuthorId extends ConceptAs<Guid> {
    static readonly valueType = Guid;
    static create(): AuthorId { return new AuthorId(Guid.create()); }
}
