// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceScope } from './ServiceScope.js';
import { ServiceDisposalState } from './ServiceDisposalState.js';
export type ServiceDisposalFrame = { scope: ServiceScope; parent: ServiceDisposalFrame | undefined; state: ServiceDisposalState };
