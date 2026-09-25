// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Commands;

namespace HttpFixture;

/// <summary>Denies selected commands before validation without affecting other fixtures.</summary>
public sealed class FilterParityAuthorizationFilter : IAuthorizationCommandFilter
{
    /// <inheritdoc/>
    public Task<CommandResult> OnExecution(CommandContext context)
    {
        var result = context.Command is FilterParityCommand command && command.Value.StartsWith("deny", StringComparison.Ordinal)
            ? CommandResult.Unauthorized(context.CorrelationId, "Fixture filter denied")
            : CommandResult.Success(context.CorrelationId);
        return Task.FromResult(result);
    }
}
