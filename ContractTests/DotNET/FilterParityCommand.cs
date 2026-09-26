// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Commands.ModelBound;

namespace HttpFixture;

/// <summary>Exercises command filter ordering and validation over HTTP.</summary>
[Command]
[AllowAnonymous]
public record FilterParityCommand(string Value)
{
    /// <summary>Returns the accepted value.</summary>
    /// <returns>The accepted value.</returns>
    public string Handle() => Value;
}
