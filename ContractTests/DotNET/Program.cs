// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Globalization;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using Cratis.Arc.Authorization;
using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Identity;
using Cratis.Arc.Queries.ModelBound;
using FluentValidation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, EnvironmentName = Environments.Production });
builder.Configuration.Sources.Clear();
builder.Logging.ClearProviders();
builder.WebHost.ConfigureKestrel(options => options.Listen(IPAddress.Loopback, 0));
builder.Services.AddSingleton<HttpFixture.EchoExecutions>();
builder.Services.AddAuthentication("Fixture")
    .AddScheme<AuthenticationSchemeOptions, HttpFixture.FixtureAuthentication>("Fixture", _ => { });
builder.AddCratisArc(configureOptions: options =>
{
    options.IdentityDetailsProvider = typeof(DefaultIdentityDetailsProvider);
    options.ExposeExceptionDetails = false;
    options.GeneratedApis.RoutePrefix = "api";
    options.GeneratedApis.SegmentsToSkipForRoute = 1;
    options.GeneratedApis.IncludeCommandNameInRoute = true;
    options.GeneratedApis.IncludeQueryNameInRoute = true;
    options.GeneratedApis.EnableQueryHttpMethod = true;
});
await using var app = builder.Build();
app.UseRouting();
app.UseAuthentication();
app.UseCratisArc();
await app.StartAsync();
var addresses = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()
    ?? throw new HttpFixture.MissingServerAddresses();
Console.WriteLine(JsonSerializer.Serialize(new
{
    kind = "typescript-dotnet-reference-ready",
    baseUrl = addresses.Addresses.Single(),
    package = "Cratis.Arc 22.22.0",
    runtime = Environment.Version.ToString(),
    coreRuntimeDirectory = RuntimeEnvironment.GetRuntimeDirectory(),
    aspNetCoreAssembly = typeof(WebApplication).Assembly.Location
}));
await app.WaitForShutdownAsync();

namespace HttpFixture
{
    /// <summary>
    /// Fixture roles accepted through the loopback-only authentication scheme.
    /// </summary>
    public enum FixtureRole { Reader, Admin }

    /// <summary>
    /// Authenticates only explicitly named fixture roles for local conformance requests.
    /// </summary>
    public sealed class FixtureAuthentication(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        /// <inheritdoc/>
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.TryGetValue("X-Fixture-Role", out var role))
            {
                return Task.FromResult(AuthenticateResult.NoResult());
            }
            if (role.Count != 1 || !Enum.TryParse<FixtureRole>(role.ToString(), ignoreCase: false, out var parsed) || role.ToString() != parsed.ToString())
            {
                return Task.FromResult(AuthenticateResult.Fail("Invalid fixture credential"));
            }
            var claims = new[] { new Claim(ClaimTypes.NameIdentifier, "fixture-user"), new Claim(ClaimTypes.Role, parsed.ToString()) };
            var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme.Name));

            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name)));
        }
    }

    /// <summary>
    /// Echoes an authorized, validated value and counts handler executions.
    /// </summary>
    [Command]
    [AllowAnonymous]
    public record EchoValue(string Value)
    {
        /// <summary>
        /// Counts this execution and returns the supplied value.
        /// </summary>
        /// <param name="executions">The fixture execution counter.</param>
        /// <returns>The echoed value.</returns>
        public EchoReply Handle(EchoExecutions executions)
        {
            executions.Record();

            return new(Value);
        }
    }

    /// <summary>
    /// Counts actual echo handler invocations within this host process.
    /// </summary>
    public sealed class EchoExecutions
    {
        long _count;

        /// <summary>
        /// Gets the number of completed increments.
        /// </summary>
        public long Count => Interlocked.Read(ref _count);

        /// <summary>
        /// Records one handler invocation.
        /// </summary>
        public void Record() => Interlocked.Increment(ref _count);
    }

    /// <summary>
    /// Exposes the current fixture-only echo execution count through Arc's query pipeline.
    /// </summary>
    /// <param name="Count">The number of actual handler invocations.</param>
    [ReadModel]
    public record EchoCount(long Count)
    {
        /// <summary>
        /// Reads the current execution count without changing it.
        /// </summary>
        /// <param name="executions">The fixture execution counter.</param>
        /// <returns>The current count.</returns>
        [AllowAnonymous]
        [Cratis.Arc.Queries.ModelBound.Path("/api/echo-count")]
        public static EchoCount Current([FromServices] EchoExecutions executions) => new(executions.Count);
    }

    /// <summary>
    /// The response to an echo command.
    /// </summary>
    /// <param name="Value">The echoed value.</param>
    public record EchoReply(string Value);

    /// <summary>
    /// Rejects blank echo values before execution, including on the validate route.
    /// </summary>
    public sealed class EchoValueValidator : CommandValidator<EchoValue>
    {
        /// <summary>
        /// Sets the required-value rule.
        /// </summary>
        public EchoValueValidator() => RuleFor(command => command.Value).NotEmpty().WithMessage("Value is required");
    }

    /// <summary>
    /// Echoes a value only for fixture administrators.
    /// </summary>
    [Command]
    [Roles(nameof(FixtureRole.Admin))]
    public record AdminEcho(string Value)
    {
        /// <summary>
        /// Returns the supplied value when authorized.
        /// </summary>
        /// <returns>The echoed value.</returns>
        public EchoReply Handle() => new(Value);
    }

    /// <summary>
    /// Exercises production exception redaction from the real command pipeline.
    /// </summary>
    [Command]
    [AllowAnonymous]
    public record ThrowFailure()
    {
        /// <summary>
        /// Raises a fixture-only domain failure.
        /// </summary>
        /// <returns>No response; this method always fails.</returns>
        /// <exception cref="FixtureFailure">Always raised.</exception>
        public EchoReply Handle() => throw new FixtureFailure();
    }

    /// <summary>
    /// The exception that is thrown when the fixture deliberately fails a command.
    /// </summary>
    public sealed class FixtureFailure : Exception
    {
        /// <summary>
        /// Initializes the deliberate failure.
        /// </summary>
        public FixtureFailure() : base("Private fixture failure detail") { }
    }

    /// <summary>
    /// The exception that is thrown when the host cannot report its bound address.
    /// </summary>
    public sealed class MissingServerAddresses : Exception
    {
        /// <summary>
        /// Initializes the host startup failure.
        /// </summary>
        public MissingServerAddresses() : base("No server address feature") { }
    }

    /// <summary>
    /// Deterministic read model used for GET, QUERY, authorization, and paging.
    /// </summary>
    /// <param name="Id">Stable item identifier.</param>
    /// <param name="Name">Stable item name.</param>
    [ReadModel]
    public record FixtureItem(int Id, string Name)
    {
        static readonly FixtureItem[] Items = [new(1, "Ada"), new(2, "Grace"), new(3, "Linus")];

        /// <summary>
        /// Returns one known item by identifier.
        /// </summary>
        /// <param name="id">The requested identifier.</param>
        /// <returns>The item, if present.</returns>
        [AllowAnonymous]
        [Cratis.Arc.Queries.ModelBound.Path("/api/items/by-id")]
        public static FixtureItem? ById(int id) => Items.FirstOrDefault(item => item.Id == id);

        /// <summary>
        /// Returns the stable fixture items in identifier order.
        /// </summary>
        /// <returns>The fixture items.</returns>
        [AllowAnonymous]
        [Cratis.Arc.Queries.ModelBound.Path("/api/items")]
        public static IQueryable<FixtureItem> All() => Items.AsQueryable();

        /// <summary>
        /// Returns the same items only for fixture administrators.
        /// </summary>
        /// <returns>The fixture items.</returns>
        [Roles(nameof(FixtureRole.Admin))]
        [Cratis.Arc.Queries.ModelBound.Path("/api/items/private")]
        public static IQueryable<FixtureItem> Private() => Items.AsQueryable();
    }
}
