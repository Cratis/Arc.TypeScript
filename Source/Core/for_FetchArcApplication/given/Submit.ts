// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '../../fetch.js';

/** A model-bound command for Fetch registration specs. */
@command()
export class Submit { handle(): string { return 'accepted'; } }
