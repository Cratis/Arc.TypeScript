// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Identity;

namespace HttpFixture;

/// <summary>The public details returned for an authorized fixture identity.</summary>
/// <param name="Greeting">A stable display greeting.</param>
public record FixtureIdentityDetails(string Greeting);

/// <summary>Allows administrators to view their fixture identity details.</summary>
public sealed class FixtureIdentityProvider : IProvideIdentityDetails<FixtureIdentityDetails>
{
    /// <inheritdoc/>
    public Task<IdentityDetails> Provide(IdentityProviderContext context) =>
        Task.FromResult(new IdentityDetails(context.Claims.Any(claim =>
            claim.Key == System.Security.Claims.ClaimTypes.Role && claim.Value == nameof(FixtureRole.Admin)),
            new FixtureIdentityDetails("Hello fixture-user")));
}
