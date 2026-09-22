using System.Globalization;
using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using BodyBiotics.Api;
using BodyBiotics.Api.Auth;
using BodyBiotics.Api.Configuration;
using BodyBiotics.Api.Features.Admin;
using BodyBiotics.Api.Features.Auth;
using BodyBiotics.Api.Features.Cart;
using BodyBiotics.Api.Features.Checkout;
using BodyBiotics.Api.Features.Contact;
using BodyBiotics.Api.Features.Notifications;
using BodyBiotics.Api.Features.Payments;
using BodyBiotics.Api.Features.Products;
using BodyBiotics.Api.Features.Promotions;
using BodyBiotics.Api.Features.Reviews;
using BodyBiotics.Api.Features.Wishlist;
using BodyBiotics.Api.Http;
using BodyBiotics.Infrastructure;
using BodyBiotics.Infrastructure.Persistence;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));

builder.Services
    .AddOptions<AppOptions>()
    .Bind(builder.Configuration.GetSection(AppOptions.SectionName))
    .ValidateDataAnnotations()
    // Fail at start, not at the first request that needs the missing value.
    .ValidateOnStart();

var appOptions = builder.Configuration
    .GetSection(AppOptions.SectionName)
    .Get<AppOptions>()
    ?? throw new InvalidOperationException($"Missing configuration section \"{AppOptions.SectionName}\".");

builder.Services.AddInfrastructure(appOptions.ConnectionString, builder.Configuration);
builder.Services.AddScoped<DatabaseSeeder>();
builder.Services.AddScoped<SessionService>();
builder.Services.AddScoped<CatalogueService>();
builder.Services.AddScoped<AdminService>();
builder.Services.AddScoped<CartService>();
builder.Services.AddScoped<CartOwnerAccessor>();
builder.Services.AddScoped<PricingService>();
builder.Services.AddScoped<PromotionService>();
builder.Services.AddScoped<CheckoutService>();
builder.Services.AddScoped<OrderAccessGrant>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<ContactService>();
builder.Services.AddScoped<PasswordResetService>();
builder.Services.AddScoped<OrderNotifier>();
builder.Services.AddSingleton<EmailOutbox>();
builder.Services.AddHostedService<EmailDispatcher>();
builder.Services.AddScoped<ReviewService>();
builder.Services.AddScoped<WishlistService>();
builder.Services.AddScoped<ReviewPhotoStore>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddValidatorsFromAssemblyContaining<ProductListRequestValidator>();
builder.Services.AddApiRateLimiting();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks().AddCheck<PostgresHealthCheck>("postgres");
builder.Services.AddScoped<HealthCheckRunner>();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    // camelCase on the wire; the TypeScript client expects nothing else.
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    // Nulls are written, not omitted: `{ "user": null }` means signed out,
    // while `{}` would reach the client as `undefined` and read as "unknown".
    // Fields that genuinely may be absent opt out with [JsonIgnore] instead.
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
});

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "bb_session";
        options.Cookie.HttpOnly = true;
        // Lax, not Strict: Paystack and Hubtel redirect back into the app after
        // payment, and a Strict cookie is not sent on that navigation.
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromDays(appOptions.SessionTtlDays);
        options.SlidingExpiration = true;

        // An API must answer 401/403 in the envelope, never redirect to a login page.
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return context.Response.WriteAsJsonAsync(new ApiErrorEnvelope(
                new ApiErrorBody("UNAUTHORIZED", "Sign in required")));
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return context.Response.WriteAsJsonAsync(new ApiErrorEnvelope(
                new ApiErrorBody("FORBIDDEN", "Not allowed")));
        };
        options.Events.OnValidatePrincipal = SessionValidator.ValidateAsync;
    });

builder.Services.AddAuthorization(options => options.AddAdminPolicy());

if (appOptions.CorsOrigins.Length > 0)
{
    // Only for calling the API directly in development. In production the
    // browser talks to the Next origin and never sees this service.
    builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
        .WithOrigins(appOptions.CorsOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));
}

var app = builder.Build();

// Behind the Next proxy, so the client IP and scheme come from headers; rate
// limiting and Secure cookies both depend on getting this right.
//
// Trust is explicit. An unrestricted list lets anyone spoof X-Forwarded-For and
// walk straight past the login limiter; the default list trusts only loopback,
// which silently ignores the real proxy the moment it is a separate container
// and collapses every customer into one rate-limit bucket. So: named proxies,
// and a loud warning if production never named one.
var forwardedOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    // One hop: the Next proxy. Anything it forwards on behalf of a further
    // upstream is that upstream's problem to append, not ours to believe.
    ForwardLimit = 1,
};

if (appOptions.TrustedProxies.Length > 0)
{
    forwardedOptions.KnownProxies.Clear();
    forwardedOptions.KnownIPNetworks.Clear();

    foreach (var entry in appOptions.TrustedProxies)
    {
        var parts = entry.Split('/', 2, StringSplitOptions.TrimEntries);

        if (!IPAddress.TryParse(parts[0], out var address))
        {
            throw new InvalidOperationException(
                $"App:TrustedProxies contains \"{entry}\", which is not an IP address or CIDR range.");
        }

        if (parts.Length == 2)
        {
            if (!int.TryParse(parts[1], CultureInfo.InvariantCulture, out var prefixLength))
            {
                throw new InvalidOperationException(
                    $"App:TrustedProxies contains \"{entry}\", whose prefix length is not a number.");
            }

            forwardedOptions.KnownIPNetworks.Add(new System.Net.IPNetwork(address, prefixLength));
        }
        else
        {
            forwardedOptions.KnownProxies.Add(address);
        }
    }
}
else if (!app.Environment.IsDevelopment())
{
    ProxyTrustLog.NoTrustedProxies(app.Logger);
}

app.UseForwardedHeaders(forwardedOptions);

app.UseExceptionHandler();
app.UseSerilogRequestLogging();

if (appOptions.CorsOrigins.Length > 0)
{
    app.UseCors();
}

// Review photos live under wwwroot/uploads and are served straight from disk.
// nosniff because they are attacker-supplied bytes: the Next proxy in front of
// this already sets it, but the API must not depend on being behind it.
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        context.Context.Response.Headers.XContentTypeOptions = "nosniff";
        context.Context.Response.Headers.ContentSecurityPolicy = "default-src 'none'; sandbox";
    },
});

// Before the endpoints, after CORS: a cross-site write is rejected whether or
// not the route it names exists.
app.UseCrossSiteRequestGuard();

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

var api = app.MapGroup("/api");
api.MapCatalogueEndpoints();
api.MapCartEndpoints();
api.MapCheckoutEndpoints();
api.MapPromotionEndpoints();
api.MapContactEndpoints();
api.MapPaymentEndpoints();
api.MapReviewEndpoints();
api.MapWishlistEndpoints();
api.MapAdminEndpoints();
api.MapAuthEndpoints();

api.MapGet("/health", async (HealthCheckRunner runner, CancellationToken cancellationToken) =>
    await runner.RunAsync(cancellationToken))
    .WithTags("Ops")
    .WithName("Health");

if (appOptions.MigrateOnStart)
{
    // These values are in the repository, so an environment that kept one would
    // have an admin account with a password anyone can read. Refuse to start
    // rather than create it.
    if (!app.Environment.IsDevelopment() &&
        AppOptions.PubliclyKnownSeedAdminPasswords.Contains(appOptions.SeedAdminPassword))
    {
        throw new InvalidOperationException(
            "App:SeedAdminPassword is a value committed to this repository. Set App__SeedAdminPassword " +
            "to a real secret, or turn App__MigrateOnStart off and run migrations as a " +
            "separate deployment step.");
    }

    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await scope.ServiceProvider
        .GetRequiredService<DatabaseSeeder>()
        .SeedAsync(app.Environment.ContentRootPath, appOptions.SeedAdminEmail, appOptions.SeedAdminPassword);
}

await app.RunAsync();

/// <summary>Exposed so the integration tests can drive the real pipeline.</summary>
public partial class Program;

internal static partial class ProxyTrustLog
{
    [LoggerMessage(
        Level = LogLevel.Warning,
        Message = "App:TrustedProxies is empty, so only loopback is trusted for X-Forwarded-For. " +
            "Behind a proxy the API sees every request as coming from one address, and rate " +
            "limiting then applies to all customers at once.")]
    public static partial void NoTrustedProxies(Microsoft.Extensions.Logging.ILogger logger);
}
