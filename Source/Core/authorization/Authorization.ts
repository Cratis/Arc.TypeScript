// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Authorization declarations on one endpoint are independent AND requirements. */
export interface Authorization {
    anonymous?: boolean;
    roles?: readonly string[];
    authenticated?: boolean;
    /** Named policy registered on the application builder or server. */
    policy?: string;
    /** Named authenticators to try for this operation instead of the default handlers. */
    schemes?: readonly string[];
    requirements?: readonly Authorization[];
}
