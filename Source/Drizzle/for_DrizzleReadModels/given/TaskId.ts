// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, Guid } from '@cratis/fundamentals';

/** UUID-backed task identity used to verify primary-key codecs. */
export class TaskId extends ConceptAs<Guid> { static readonly valueType = Guid; }
