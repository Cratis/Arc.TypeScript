// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '../../../modelBound/index.js';
class Second { handle() { return 'second'; } }
command()(Second);
export { Second };
