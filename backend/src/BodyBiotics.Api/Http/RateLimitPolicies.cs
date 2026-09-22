using System.Globalization;
using System.Threading.RateLimiting;
using BodyBiotics.Api.Http;
using Microsoft.AspNetCore.RateLimiting;

namespace BodyBiotics.Api;

public static class RateLimitPolicies
{
    /// <summary>Credential endpoints: the ones worth brute-forcing.</summary>
    public const string Auth = "auth";

    private static string ClientKey(HttpContext httpContext) =>
        httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    public static IServiceCollection AddApiRateLimiting(this IServiceCollection services) =>
        services.AddRateLimiter(options =>
        {
            options.AddPolicy(Auth, httpContext => RateLimitPartition.GetFixedWindowLimiter(
                // Partition by IP. Behind the Next proxy that is the proxy's
                // address unless forwarded headers are honoured — which they
                // are, see UseForwardedHeaders and App:TrustedProxies in Program.cs.
                ClientKey(httpContext),
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }));

            // Everything else — the catalogue, the cart, health. Not about
            // protecting the customer's data, which the Auth policy and
            // authorisation already do, but about a scraper or a bored script
            // being able to saturate the API.
            //
            // Deliberately generous. Ghanaian mobile networks put a lot of real
            // customers behind one carrier NAT address, so a tight global limit
            // throttles a whole network, not an attacker. This is about two
            // orders of magnitude above what a person browsing can produce.
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(
                httpContext => RateLimitPartition.GetFixedWindowLimiter(
                    ClientKey(httpContext),
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 600,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                    }));

            options.OnRejected = async (context, cancellationToken) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
                }

                // Same envelope as everything else; the client already knows
                // how to surface RATE_LIMITED.
                await context.HttpContext.Response.WriteAsJsonAsync(
                    new ApiErrorEnvelope(new ApiErrorBody(
                        ApiResults.ToWireCode(ApiErrorCode.RateLimited),
                        "Too many attempts. Try again shortly.")),
                    cancellationToken);
            };
        });
}
