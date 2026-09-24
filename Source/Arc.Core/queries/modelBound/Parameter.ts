// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ParameterArgument } from './ParameterArgument.js';
import type { ParameterService } from './ParameterService.js';
/** Query parameter declaration: a wire argument or an injected service. */
export type Parameter = ParameterArgument | ParameterService;
