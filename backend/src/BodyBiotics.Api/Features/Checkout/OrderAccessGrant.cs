using Microsoft.AspNetCore.DataProtection;

namespace BodyBiotics.Api.Features.Checkout;

/// <summary>
/// Records which orders this browser is allowed to read.
///
/// A guest has no account, so the only thing identifying their order is the
/// reference — and a reference in a URL is readable by anyone it is forwarded
/// to. Checkout therefore hands the browser a cookie naming the orders it
/// placed, and a guest lookup has to present it. The cookie rather than an
/// email in the query string: it survives a reload and the payment redirect,
/// and keeps the customer's address out of the access logs.
///
/// The contents are signed with the data protection key ring. HttpOnly stops
/// page script reading the cookie; it does nothing to stop someone sending
/// whatever cookie they like from curl, so an unsigned list would make this no
/// check at all — anyone who came across a reference could read the customer's
/// name, phone number and address. Signed, the cookie is a capability this
/// server issued, and forging one means forging a signature.
/// </summary>
public sealed class OrderAccessGrant(
    IHttpContextAccessor httpContextAccessor,
    IWebHostEnvironment environment,
    IDataProtectionProvider dataProtection)
{
    private readonly IDataProtector _protector =
        dataProtection.CreateProtector("BodyBiotics.OrderAccessGrant.v1");

    public const string Cookie = "bb_orders";

    /// <summary>Roughly a delivery cycle: long enough to track an order, short enough to expire.</summary>
    private static readonly TimeSpan Lifetime = TimeSpan.FromDays(90);

    /// <summary>Oldest references drop off rather than growing the header without bound.</summary>
    private const int MaxReferences = 20;

    public void Grant(string reference)
    {
        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext is null)
        {
            return;
        }

        var references = Read(httpContext)
            .Where(existing => !string.Equals(existing, reference, StringComparison.Ordinal))
            .Prepend(reference)
            .Take(MaxReferences);

        var value = _protector.Protect(string.Join(' ', references));

        httpContext.Response.Cookies.Append(Cookie, value, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            // Not Request.IsHttps: behind the proxy that is only correct once
            // forwarded headers are trusted, and a cookie missing Secure is a
            // failure nobody notices.
            Secure = !environment.IsDevelopment(),
            Path = "/",
            MaxAge = Lifetime,
        });
    }

    public bool Holds(string reference)
    {
        var httpContext = httpContextAccessor.HttpContext;

        return httpContext is not null &&
            Read(httpContext).Any(granted => string.Equals(granted, reference, StringComparison.Ordinal));
    }

    /// <summary>
    /// Anything that does not carry this server's signature reads as no grant
    /// at all — a forgery, and equally a cookie issued before a key rotation.
    /// Both cases leave the customer looking up the order by signing in or
    /// contacting the shop, which is the same place they would be with no
    /// cookie at all.
    /// </summary>
    private string[] Read(HttpContext httpContext)
    {
        if (httpContext.Request.Cookies[Cookie] is not { Length: > 0 } value)
        {
            return [];
        }

        try
        {
            return _protector.Unprotect(value)
                .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        }
        catch (System.Security.Cryptography.CryptographicException)
        {
            return [];
        }
    }
}
