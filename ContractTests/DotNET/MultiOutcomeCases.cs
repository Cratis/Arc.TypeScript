// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Validation;
using Cratis.Monads;
using OneOf;

namespace HttpFixture;

/// <summary>
/// A business failure is still an ordinary response unless a value handler consumes it.
/// </summary>
/// <param name="Code">The failure code.</param>
public record OutcomeError(string Code);

/// <summary>
/// Selects either a DTO response or a validation failure.
/// </summary>
[Command]
[AllowAnonymous]
public record OutcomeDto(bool Fail)
{
    /// <summary>Returns the selected branch.</summary>
    public OneOf<EchoReply, ValidationResult> Handle() => Fail
        ? OneOf<EchoReply, ValidationResult>.FromT1(ValidationResult.Error("Outcome rejected", ["fail"]))
        : OneOf<EchoReply, ValidationResult>.FromT0(new EchoReply("created"));
}

/// <summary>
/// Selects either a primitive response or an authorization denial.
/// </summary>
[Command]
[AllowAnonymous]
public record OutcomePrimitive(bool Fail)
{
    /// <summary>Returns the selected branch.</summary>
    public OneOf<int, AuthorizationResult> Handle() => Fail
        ? OneOf<int, AuthorizationResult>.FromT1(AuthorizationResult.Failure("Outcome denied"))
        : OneOf<int, AuthorizationResult>.FromT0(42);
}

/// <summary>
/// A Result error DTO is not a validation or authorization failure.
/// </summary>
[Command]
[AllowAnonymous]
public record OutcomeErrorCase(bool Fail)
{
    /// <summary>Returns the selected branch.</summary>
    public Result<EchoReply, OutcomeError> Handle() => Fail
        ? Result<EchoReply, OutcomeError>.Failed(new OutcomeError("already-exists"))
        : Result<EchoReply, OutcomeError>.Success(new EchoReply("created"));
}

/// <summary>
/// OneOf alternatives can contain simultaneous tuple values.
/// </summary>
[Command]
[AllowAnonymous]
public record OutcomeTuple(bool Fail)
{
    /// <summary>Returns the selected branch.</summary>
    public OneOf<EchoReply, (EchoReply, ValidationResult)> Handle() => Fail
        ? OneOf<EchoReply, (EchoReply, ValidationResult)>.FromT1((new EchoReply("ignored"), ValidationResult.Error("Tuple rejected", ["fail"])))
        : OneOf<EchoReply, (EchoReply, ValidationResult)>.FromT0(new EchoReply("created"));
}
