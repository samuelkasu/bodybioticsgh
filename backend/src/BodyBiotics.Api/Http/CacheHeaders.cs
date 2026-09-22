using Microsoft.AspNetCore.Http.Headers;

namespace BodyBiotics.Api.Http;

/// <summary>
/// Cache policy is per endpoint and explicit. Getting this wrong on an
/// e-commerce API puts one customer's session into a shared cache for everyone.
/// </summary>
public static class CacheHeaders
{
    /// <summary>Catalogue reads: shareable, revalidated in the background by the CDN.</summary>
    public static void Catalogue(HttpResponse response)
    {
        var headers = new ResponseHeaders(response.Headers)
        {
            CacheControl = new()
            {
                Public = true,
                SharedMaxAge = TimeSpan.FromSeconds(60),
            },
        };

        // stale-while-revalidate has no first-class property on CacheControlHeaderValue.
        headers.Headers.CacheControl = $"{headers.CacheControl}, stale-while-revalidate=300";
    }

    /// <summary>Anything user-specific: never a shared cache, never the service worker.</summary>
    public static void Private(HttpResponse response) =>
        response.Headers.CacheControl = "private, no-store";
}
