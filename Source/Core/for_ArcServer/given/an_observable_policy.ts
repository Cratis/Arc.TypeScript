// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { observableExecution } from './an_observable_execution.js';

export class an_observable_policy {
    execution() { return observableExecution({ principal: { id: 'alice', roles: [], isAuthenticated: true } }); }
}
