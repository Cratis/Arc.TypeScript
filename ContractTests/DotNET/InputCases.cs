// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Queries;
using Cratis.Arc.Queries.ModelBound;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;

namespace HttpFixture;

/// <summary>Counts command handlers that passed input binding and validation.</summary>
public sealed class InputCaseExecutions
{
    long _count;

    /// <summary>Gets the number of handler invocations.</summary>
    public long Count => Interlocked.Read(ref _count);

    /// <summary>Records a handler invocation.</summary>
    public void Record() => Interlocked.Increment(ref _count);
}

/// <summary>A command with integer, enum, and concept inputs.</summary>
/// <param name="Count">A 32-bit count.</param>
/// <param name="State">A known state.</param>
/// <param name="Rate">A validated numeric concept.</param>
[Command]
[AllowAnonymous]
public record InputCases(int Count, MetricState State, FixtureRate Rate)
{
    /// <summary>Counts successfully executed commands.</summary>
    /// <param name="executions">The fixture execution counter.</param>
    /// <returns>The supplied integer.</returns>
    public int Handle(InputCaseExecutions executions)
    {
        executions.Record();
        return Count;
    }
}

/// <summary>Exposes the input-case handler count.</summary>
/// <param name="Count">The number of executions.</param>
[ReadModel]
public record InputCaseCount(long Count)
{
    /// <summary>Reads the current count.</summary>
    /// <param name="executions">The fixture counter.</param>
    /// <returns>The current count.</returns>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/input-case-count")]
    public static InputCaseCount Current([FromServices] InputCaseExecutions executions) => new(executions.Count);
}

/// <summary>Counts validated query performer invocations.</summary>
public sealed class QueryCaseExecutions
{
    long _count;

    /// <summary>Gets the number of invocations.</summary>
    public long Count => Interlocked.Read(ref _count);

    /// <summary>Records one invocation.</summary>
    public void Record() => Interlocked.Increment(ref _count);
}

/// <summary>Reads how often the query performer ran.</summary>
/// <param name="Count">The invocation count.</param>
[ReadModel]
public record QueryCaseCount(long Count)
{
    /// <summary>Reads the query performer count.</summary>
    /// <param name="executions">The invocation counter.</param>
    /// <returns>The current count.</returns>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/query-case-count")]
    public static QueryCaseCount Current([FromServices] QueryCaseExecutions executions) => new(executions.Count);
}

/// <summary>An argument model for validating the query input.</summary>
/// <param name="Value">The supplied query value.</param>
public record QueryCaseFindParameters(string Value);

/// <summary>Rejects blank query arguments before performing the query.</summary>
public sealed class QueryCaseFindParametersValidator : QueryValidator<QueryCaseFindParameters>
{
    /// <summary>Defines the required-value rule.</summary>
    public QueryCaseFindParametersValidator() => RuleFor(arguments => arguments.Value).NotEmpty().WithMessage("Value is required");
}

/// <summary>A query with a validated input and a throwing performer.</summary>
/// <param name="Value">The returned value.</param>
[ReadModel]
public record QueryCase(string Value)
{
    /// <summary>Returns the argument if validation passed.</summary>
    /// <param name="value">The query value.</param>
    /// <param name="executions">The invocation counter.</param>
    /// <returns>The value.</returns>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/query-case/find")]
    public static QueryCase Find(string value, [FromServices] QueryCaseExecutions executions)
    {
        executions.Record();
        return new(value);
    }

    /// <summary>Throws a fixture-only exception.</summary>
    /// <returns>No value.</returns>
    /// <exception cref="FixtureFailure">Always raised.</exception>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/query-case/fail")]
    public static QueryCase Fail() => throw new FixtureFailure();
}
