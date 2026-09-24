// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { authorize, command } from '@cratis/arc.core';

@command()
@authorize()
export class RestrictedCommand {
    handle(): string { return 'protected'; }
}
