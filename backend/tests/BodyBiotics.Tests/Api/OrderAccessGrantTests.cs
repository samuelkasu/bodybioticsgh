using BodyBiotics.Api.Features.Checkout;
using BodyBiotics.Domain.Common;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace BodyBiotics.Tests.Api;

/// <summary>
/// The grant cookie is the only thing standing between a guest order reference
/// and the customer's name, phone number and address, so what matters here is
/// that it cannot be written by hand.
/// </summary>
public class OrderAccessGrantTests
{
    private const string Reference = "BB-20260922-ABCD1234";

    [Fact]
    public void HoldsWhatItGranted()
    {
        var (grant, context) = Build();

        grant.Grant(Reference);
        Replay(context);

        Assert.True(grant.Holds(Reference));
    }

    [Fact]
    public void DoesNotHoldAReferenceItNeverIssued()
    {
        var (grant, context) = Build();

        grant.Grant(Reference);
        Replay(context);

        Assert.False(grant.Holds("BB-20260922-ZZZZ9999"));
    }

    [Fact]
    public void RejectsACookieTheClientWroteItself()
    {
        var (grant, context) = Build();

        // Exactly what curl -H "Cookie: bb_orders=<reference>" sends. HttpOnly
        // does not stop this; the signature does.
        context.Request.Headers.Cookie = $"{OrderAccessGrant.Cookie}={Reference}";

        Assert.False(grant.Holds(Reference));
    }

    [Fact]
    public void RejectsATamperedSignature()
    {
        var (grant, context) = Build();

        grant.Grant(Reference);
        Replay(context);

        var issued = context.Request.Headers.Cookie.ToString();
        context.Request.Headers.Cookie = issued[..^2] + (issued[^2] == 'A' ? "BB" : "AA");

        Assert.False(grant.Holds(Reference));
    }

    [Fact]
    public void RemembersEveryOrderTheBrowserPlaced()
    {
        var (grant, context) = Build();
        var second = "BB-20260922-EFGH5678";

        grant.Grant(Reference);
        Replay(context);
        grant.Grant(second);
        Replay(context);

        Assert.True(grant.Holds(Reference));
        Assert.True(grant.Holds(second));
    }

    /// <summary>
    /// Moves the cookie the response just set onto the next request, the way a
    /// browser would.
    /// </summary>
    private static void Replay(HttpContext context)
    {
        var setCookie = context.Response.Headers.SetCookie.ToString();
        var value = setCookie.Split(';')[0];

        context.Request.Headers.Cookie = value;
        context.Response.Headers.Remove("Set-Cookie");
    }

    private static (OrderAccessGrant Grant, HttpContext Context) Build()
    {
        var context = new DefaultHttpContext();
        var accessor = new HttpContextAccessor { HttpContext = context };

        var grant = new OrderAccessGrant(
            accessor,
            new StubEnvironment(),
            DataProtectionProvider.Create(nameof(OrderAccessGrantTests)));

        return (grant, context);
    }

    private sealed class StubEnvironment : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Production;
        public string ApplicationName { get; set; } = "Tests";
        public string WebRootPath { get; set; } = string.Empty;
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}

public class IdentifierTests
{
    /// <summary>
    /// The anonymous cart cookie holds one of these, and it is the only thing
    /// naming that cart — so the random half must not come from a generator
    /// whose state can be recovered from earlier ids.
    /// </summary>
    [Fact]
    public void GeneratesDistinctIdsWithinTheSameMillisecond()
    {
        var ids = new HashSet<string>(StringComparer.Ordinal);

        for (var i = 0; i < 10_000; i++)
        {
            Assert.True(ids.Add(Identifier.New()));
        }
    }
}
