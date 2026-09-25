// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Queries.ModelBound;
using System.Reactive.Subjects;

namespace HttpFixture;

/// <summary>An observable query sharing global query admission.</summary>
[ReadModel]
public record FilterParityStream(string Value)
{
    /// <summary>Provide an immediately available value.</summary>
    /// <param name="value">The stream argument.</param>
    /// <returns>The stream.</returns>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/filter-parity-stream")]
    public static ISubject<FilterParityStream> Current(string value) => new BehaviorSubject<FilterParityStream>(new(value));
}
