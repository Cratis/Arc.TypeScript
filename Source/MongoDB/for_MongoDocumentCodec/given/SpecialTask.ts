// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { derivedType, field } from '@cratis/fundamentals';
import { TaskItem } from './a_decorated_task.js';
@derivedType('special')
export class SpecialTask extends TaskItem { @field(String) extra!: string; }
