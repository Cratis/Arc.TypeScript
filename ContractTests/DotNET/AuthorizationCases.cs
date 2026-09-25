// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Queries.ModelBound;

namespace HttpFixture;

/// <summary>A class-protected read model with a public method override.</summary>
/// <param name="Value">The returned value.</param>
[ReadModel]
[Authorize]
public record AuthorizationOverride(string Value)
{
    /// <summary>Returns a value to anonymous callers despite class authorization.</summary>
    /// <returns>A public value.</returns>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/auth-override/public")]
    public static AuthorizationOverride Public() => new("public");

    /// <summary>Returns a value to authenticated callers only.</summary>
    /// <returns>A protected value.</returns>
    [Cratis.Arc.Queries.ModelBound.Path("/api/auth-override/private")]
    public static AuthorizationOverride Private() => new("private");
}

/// <summary>A command protected on its class but open on its handler.</summary>
[Command]
[Authorize]
public record PublicOverrideCommand()
{
    /// <summary>Handles the command for anonymous callers.</summary>
    /// <returns>The public value.</returns>
    [AllowAnonymous]
    public EchoReply Handle() => new("public");
}

/// <summary>Accepts either fixture role at class level but requires Admin at method level.</summary>
/// <param name="Value">The returned value.</param>
[ReadModel]
[Roles(nameof(FixtureRole.Admin), nameof(FixtureRole.Reader))]
public record RoleCases(string Value)
{
    /// <summary>Accepts Admin or Reader via the class-level role declaration.</summary>
    /// <returns>The class role value.</returns>
    [Cratis.Arc.Queries.ModelBound.Path("/api/role-cases/either")]
    public static RoleCases Either() => new("either");

    /// <summary>Requires Admin in addition to the class-level role choice.</summary>
    /// <returns>The method role value.</returns>
    [Roles(nameof(FixtureRole.Admin))]
    [Cratis.Arc.Queries.ModelBound.Path("/api/role-cases/both")]
    public static RoleCases Both() => new("both");
}
