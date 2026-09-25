// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from './ServiceLifetime.js';
import { lifetime } from './lifetime.js';
import type { DualClassDecorator } from '../reflection/DualClassDecorator.js';

/** Register a discovered service once per application. */
export function singleton(): DualClassDecorator { return lifetime(ServiceLifetime.Singleton); }
