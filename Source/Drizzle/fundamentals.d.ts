// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
// Fundamentals 7.19.3 publishes extensionless declaration re-exports incompatible with NodeNext.
declare module '@cratis/fundamentals' {
    export { ConceptAs } from '@cratis/fundamentals/dist/esm/ConceptAs.js';
    export { DateOnly } from '@cratis/fundamentals/dist/esm/DateOnly.js';
    export { Guid } from '@cratis/fundamentals/dist/esm/Guid.js';
    export { TimeOnly } from '@cratis/fundamentals/dist/esm/TimeOnly.js';
    export { TimeSpan } from '@cratis/fundamentals/dist/esm/TimeSpan.js';
}
