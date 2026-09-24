// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Concepts;

namespace HttpFixture;

/// <summary>
/// A concept used both directly and inside command array members.
/// </summary>
/// <param name="Value">The hourly rate.</param>
public record FixtureRate(decimal Value) : ConceptAs<decimal>(Value);
