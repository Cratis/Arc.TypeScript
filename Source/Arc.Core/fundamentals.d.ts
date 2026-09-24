// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
// Fundamentals 7.19.3 publishes extensionless ESM declaration re-exports that NodeNext cannot resolve.
// Augment its declarations with direct file references until the published package uses NodeNext exports.
declare module '@cratis/fundamentals' {
    export { ConceptAs } from '../../node_modules/@cratis/fundamentals/dist/esm/ConceptAs.js';
    export { DateOnly } from '../../node_modules/@cratis/fundamentals/dist/esm/DateOnly.js';
    export { Fields } from '../../node_modules/@cratis/fundamentals/dist/esm/Fields.js';
    export { Guid } from '../../node_modules/@cratis/fundamentals/dist/esm/Guid.js';
    export { TimeOnly } from '../../node_modules/@cratis/fundamentals/dist/esm/TimeOnly.js';
    export { TimeSpan } from '../../node_modules/@cratis/fundamentals/dist/esm/TimeSpan.js';
    export type { Field } from '../../node_modules/@cratis/fundamentals/dist/esm/Field.js';
}
