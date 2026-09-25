// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '@cratis/arc.core/fetch';

/** A model-bound command used by the runtime smoke checks. */
export class Submit { handle() { return 'accepted'; } }
command()(Submit);
