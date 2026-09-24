// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Validation;

namespace HttpFixture;

/// <summary>
/// Exercises the reference pipeline's tuple response and validation value handler.
/// </summary>
/// <param name="Value">The candidate response value.</param>
[Command]
[AllowAnonymous]
public record TupleEcho(string Value)
{
    /// <summary>
    /// Returns a client value and a server-handled rejection in one tuple.
    /// </summary>
    /// <returns>The response graph.</returns>
    public (EchoReply, ValidationResult) Handle() => (new(Value), ValidationResult.Error("Cannot echo", ["value"]));
}
