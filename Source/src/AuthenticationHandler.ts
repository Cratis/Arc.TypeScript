// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { AuthenticationResult } from './AuthenticationResult.js';
export type AuthenticationHandler = (request: Request) => AuthenticationResult | Promise<AuthenticationResult>;
