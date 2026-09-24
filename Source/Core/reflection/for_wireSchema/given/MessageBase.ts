// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';

/** Wire base for a polymorphic message. */
export class MessageBase {
    @field(String) title!: string;
}
