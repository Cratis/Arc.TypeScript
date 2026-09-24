// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace HttpFixture;

/// <summary>
/// A candidate to include in the command.
/// </summary>
/// <param name="Rate">Their hourly rate.</param>
public record FixtureCandidate(FixtureRate Rate);
