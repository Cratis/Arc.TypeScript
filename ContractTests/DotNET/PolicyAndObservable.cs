// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Reactive.Subjects;
using Cratis.Arc.Authorization;
using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Queries.ModelBound;
using FluentValidation;

namespace HttpFixture;

/// <summary>Allows fixture administrators to execute policy-protected operations.</summary>
public sealed class FixtureAdminPolicy : IAuthorizationPolicy
{
    /// <inheritdoc/>
    public ValueTask<bool> IsAuthorized(AuthorizationPolicyContext context, CancellationToken cancellationToken) =>
        ValueTask.FromResult(context.Principal.IsInRole(nameof(FixtureRole.Admin)));
}

/// <summary>A command protected by a named policy.</summary>
[Command]
[Authorize(Policy = "FixtureAdmin")]
public record PolicyEcho(string Value)
{
    /// <summary>Echoes an authorized value.</summary>
    /// <returns>The supplied value.</returns>
    public EchoReply Handle() => new(Value);
}

/// <summary>Validates only after the named policy allows the command.</summary>
public sealed class PolicyEchoValidator : CommandValidator<PolicyEcho>
{
    /// <summary>Requires a nonempty value.</summary>
    public PolicyEchoValidator() => RuleFor(command => command.Value).NotEmpty().WithMessage("Value is required");
}

/// <summary>A read model protected by a named policy.</summary>
[ReadModel]
[Authorize(Policy = "FixtureAdmin")]
public record PolicyItems(string Value)
{
    /// <summary>Returns policy-protected data.</summary>
    /// <returns>A single read model.</returns>
    [Cratis.Arc.Queries.ModelBound.Path("/api/policy-items")]
    public static PolicyItems All() => new("allowed");
}

/// <summary>Queries a numeric concept as a model-bound argument.</summary>
[ReadModel]
public record RateLookup(decimal Value)
{
    /// <summary>Returns the unwrapped concept value.</summary>
    /// <param name="rate">The rate to read.</param>
    /// <returns>The rate.</returns>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/rate-lookup")]
    public static RateLookup ByRate(FixtureRate rate) => new(rate.Value);
}

/// <summary>Exposes current and pending observable snapshots.</summary>
[ReadModel]
public record FixtureStream(string Value)
{
    static readonly BehaviorSubject<FixtureStream> CurrentValue = new(new("ready"));
    static readonly Subject<FixtureStream> PendingValue = new();

    /// <summary>Returns a stream with a current value.</summary>
    /// <returns>The current-value stream.</returns>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/fixture-stream/current")]
    public static ISubject<FixtureStream> Current() => CurrentValue;

    /// <summary>Returns a stream without an initial value.</summary>
    /// <returns>The pending stream.</returns>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/fixture-stream/pending")]
    public static ISubject<FixtureStream> Pending() => PendingValue;

    /// <summary>Emits its first value after a short delay for HTTP wait requests.</summary>
    /// <returns>A new, initially pending source.</returns>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/fixture-stream/first")]
    public static ISubject<FixtureStream> First()
    {
        var subject = new Subject<FixtureStream>();
        _ = Task.Run(async () =>
        {
            await Task.Delay(150);
            subject.OnNext(new("first"));
            subject.OnCompleted();
        });
        return subject;
    }

    /// <summary>Completes without emitting a value.</summary>
    /// <returns>A new, initially pending source.</returns>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/fixture-stream/completed")]
    public static ISubject<FixtureStream> Completed()
    {
        var subject = new Subject<FixtureStream>();
        _ = Task.Run(async () =>
        {
            await Task.Delay(80);
            subject.OnCompleted();
        });
        return subject;
    }
}
