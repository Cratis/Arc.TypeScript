// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Hub delivery preference; absent or unknown values preserve legacy full plus changes. */
export enum ObservableTransferMode {
    Full = 'full',
    Delta = 'delta',
    Legacy = 'legacy'
}
