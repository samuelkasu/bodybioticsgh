using System.Security.Claims;
using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;

namespace BodyBiotics.Api.Features.Cart;

/// <summary>
/// Decides whose cart a request is for: the signed-in user, or the anonymous
/// cart cookie. The cookie is issued on first write so a visitor can shop
/// before creating an account — the single biggest conversion factor on a
/// storefront.
/// </summary>
public sealed class CartOwnerAccessor(
    IHttpContextAccessor httpContextAccessor,
    IWebHostEnvironment environment)
{
    public const string AnonCookie = "bb_cart";

    private static readonly TimeSpan AnonLifetime = TimeSpan.FromDays(60);

    public CartOwner Resolve(bool createIfMissing)
    {
        var httpContext = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("No HTTP context to resolve a cart for.");

        var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
        {
            return CartOwner.ForUser(userId);
        }

        var anonId = httpContext.Request.Cookies[AnonCookie];

        if (string.IsNullOrEmpty(anonId))
        {
            // Reads must not mint a cookie: that would hand one to every crawler.
            if (!createIfMissing)
            {
                return CartOwner.ForAnonymous(string.Empty);
            }

            anonId = Identifier.New();
            httpContext.Response.Cookies.Append(AnonCookie, anonId, new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                // Not Request.IsHttps: behind the proxy that is only true once
                // X-Forwarded-Proto is trusted, and silently dropping Secure is
                // not a failure anyone notices.
                Secure = !environment.IsDevelopment(),
                Path = "/",
                MaxAge = AnonLifetime,
            });
        }

        return CartOwner.ForAnonymous(anonId);
    }

    public string? CurrentAnonId() =>
        httpContextAccessor.HttpContext?.Request.Cookies[AnonCookie];

    /// <summary>Called after a cart merge, so the stale cookie cannot resurrect it.</summary>
    public void ClearAnonCookie()
    {
        httpContextAccessor.HttpContext?.Response.Cookies.Delete(AnonCookie, new CookieOptions
        {
            Path = "/",
        });
    }
}
