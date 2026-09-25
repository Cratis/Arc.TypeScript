// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { response, type Outcome } from '@cratis/arc.core';
import { Plain } from '../Responses.js';

export class EventOutcomeArray { handle(): Outcome<Plain>[] { return [response(new Plain())]; } }
export class StringOutcomeArray { handle(): Outcome<string>[] { return [response('visible')]; } }
