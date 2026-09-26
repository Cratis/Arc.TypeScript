// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Queries;

namespace HttpFixture;

/// <summary>Denies selected query arguments before validation.</summary>
public sealed class FilterParityQueryAuthorizationFilter : IAuthorizationQueryFilter
{
    /// <inheritdoc/>
    public Task<QueryResult> OnPerform(QueryContext context)
    {
        var result = context.Arguments?.Values.Any(value =>
            value is string text && text.StartsWith("deny", StringComparison.Ordinal)) == true
            ? QueryResult.Unauthorized(context.CorrelationId)
            : QueryResult.Success(context.CorrelationId);
        return Task.FromResult(result);
    }
}
