namespace BodyBiotics.Api.Http;

/// <summary>
/// Refuses state-changing requests a browser has told us came from another
/// site.
///
/// The session cookie is SameSite=Lax, which is already the main CSRF control:
/// a cross-site form POST does not carry it. This is the second layer, for the
/// cases Lax does not cover — a browser that ignores SameSite, and a sibling
/// subdomain, which counts as same-site to a cookie but not to Sec-Fetch-Site.
///
/// The header is set by the browser itself and cannot be forged from script,
/// and it survives the Next proxy untouched, so unlike an Origin/Host check
/// this needs no knowledge of where the API is deployed.
///
/// Requests with no Sec-Fetch-Site are allowed: that is every non-browser
/// caller, including the Hubtel payment callback, which is authenticated by
/// its own secret and re-checks status with the provider regardless.
/// </summary>
public static class CrossSiteRequestGuard
{
    private const string Header = "Sec-Fetch-Site";

    public static IApplicationBuilder UseCrossSiteRequestGuard(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            if (IsStateChanging(context.Request.Method) &&
                string.Equals(context.Request.Headers[Header], "cross-site", StringComparison.Ordinal))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new ApiErrorEnvelope(
                    new ApiErrorBody(
                        ApiResults.ToWireCode(ApiErrorCode.Forbidden),
                        "Cross-site requests are not accepted.")));
                return;
            }

            await next();
        });

    private static bool IsStateChanging(string method) =>
        !HttpMethods.IsGet(method) &&
        !HttpMethods.IsHead(method) &&
        !HttpMethods.IsOptions(method) &&
        !HttpMethods.IsTrace(method);
}
