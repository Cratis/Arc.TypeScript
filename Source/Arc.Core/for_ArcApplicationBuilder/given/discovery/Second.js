// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '../../../commands/modelBound/command.js';
class Second { handle() { return 'second'; } }
command()(Second);
export { Second };
