// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Commands.ModelBound;

namespace HttpFixture;

/// <summary>
/// Exercises nested concept validation in real HTTP requests.
/// </summary>
/// <param name="Rate">The command's own rate.</param>
/// <param name="Candidates">The candidate collection.</param>
[Command]
[AllowAnonymous]
public record ValidationGraphCommand(FixtureRate Rate, FixtureCandidate[] Candidates)
{
    /// <summary>
    /// Returns the candidate count when validation passes.
    /// </summary>
    /// <returns>The number of candidates.</returns>
    public int Handle() => Candidates.Length;
}
