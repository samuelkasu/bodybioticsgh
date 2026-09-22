using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Tests.Domain;

public class MoneyTests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 0.01)]
    [InlineData(12_500, 125)]
    public void ConvertsMinorToMajor(int minor, decimal expected)
    {
        Assert.Equal(expected, Money.ToMajor(minor));
    }

    [Theory]
    [InlineData(125.00, 12_500)]
    [InlineData(0.99, 99)]
    // Half-up, not banker's rounding: a customer expects 0.005 to round up.
    [InlineData(0.005, 1)]
    public void ConvertsMajorToMinor(decimal major, int expected)
    {
        Assert.Equal(expected, Money.FromMajor(major));
    }

    [Fact]
    public void RoundTripsWithoutDrift()
    {
        const int original = 99_999;

        Assert.Equal(original, Money.FromMajor(Money.ToMajor(original)));
    }

    [Fact]
    public void FormatsWithCurrencyAndTwoDecimals()
    {
        Assert.Equal("GHS 125.00", Money.Format(12_500));
    }
}

public class CartTests
{
    private static Product Product(int priceMinor, int stock = 10) => new()
    {
        Id = Identifier.New(),
        Slug = "glow-serum",
        Name = "Glow Serum",
        Description = "Vitamin C serum",
        PriceMinor = priceMinor,
        ImageUrl = "/assets/dfef.jpg",
        Stock = stock,
    };

    [Fact]
    public void SubtotalSumsEveryLine()
    {
        var cart = new Cart { Id = Identifier.New() };
        cart.Items.Add(new CartItem
        {
            Id = Identifier.New(),
            CartId = cart.Id,
            ProductId = "a",
            Product = Product(12_500),
            Quantity = 2,
        });
        cart.Items.Add(new CartItem
        {
            Id = Identifier.New(),
            CartId = cart.Id,
            ProductId = "b",
            Product = Product(9_900),
            Quantity = 3,
        });

        Assert.Equal(5, cart.ItemCount);
        Assert.Equal((12_500 * 2) + (9_900 * 3), cart.SubtotalMinor);
    }

    [Fact]
    public void EmptyCartTotalsZero()
    {
        var cart = new Cart { Id = Identifier.New() };

        Assert.Equal(0, cart.ItemCount);
        Assert.Equal(0, cart.SubtotalMinor);
    }

    [Theory]
    [InlineData(-5, 0)]
    [InlineData(0, 0)]
    [InlineData(3, 3)]
    [InlineData(500, CartItem.MaxQuantityPerLine)]
    public void ClampsQuantityToTheAllowedRange(int requested, int expected)
    {
        Assert.Equal(expected, CartItem.ClampQuantity(requested));
    }

    [Theory]
    [InlineData(5, 3, true)]
    [InlineData(3, 3, true)]
    [InlineData(2, 3, false)]
    [InlineData(5, 0, false)]
    public void FulfilmentChecksStock(int stock, int quantity, bool expected)
    {
        Assert.Equal(expected, Product(1_000, stock).CanFulfil(quantity));
    }

    [Fact]
    public void InactiveProductCannotBeFulfilledEvenWithStock()
    {
        var product = Product(1_000, stock: 50);
        product.Active = false;

        Assert.False(product.CanFulfil(1));
    }
}

public class SessionTests
{
    private static Session NewSession(DateTimeOffset expiresAt) => new()
    {
        Id = Identifier.New(),
        UserId = Identifier.New(),
        ExpiresAt = expiresAt,
    };

    [Fact]
    public void FreshSessionIsActive()
    {
        var now = DateTimeOffset.UtcNow;

        Assert.True(NewSession(now.AddDays(30)).IsActive(now));
    }

    [Fact]
    public void ExpiredSessionIsNotActive()
    {
        var now = DateTimeOffset.UtcNow;

        Assert.False(NewSession(now.AddSeconds(-1)).IsActive(now));
    }

    [Fact]
    public void RevokedSessionIsNotActiveEvenBeforeExpiry()
    {
        var now = DateTimeOffset.UtcNow;
        var session = NewSession(now.AddDays(30));
        session.RevokedAt = now;

        // This is the whole point of storing sessions: remote sign-out.
        Assert.False(session.IsActive(now));
    }
}

public class IdentifierTests
{
    [Fact]
    public void GeneratesUniqueIds()
    {
        var ids = Enumerable.Range(0, 1_000).Select(_ => Identifier.New()).ToHashSet();

        Assert.Equal(1_000, ids.Count);
    }

    [Fact]
    public void IdsSortByCreationTime()
    {
        var first = Identifier.New();
        Thread.Sleep(2);
        var second = Identifier.New();

        // Time-ordered ids keep Postgres index inserts at the right edge.
        Assert.True(string.CompareOrdinal(first, second) < 0);
    }

    [Fact]
    public void OrderReferenceIsDateStampedAndReadable()
    {
        var reference = Identifier.OrderReference(new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero));

        Assert.StartsWith("BB-20260102-", reference, StringComparison.Ordinal);
        Assert.Equal(20, reference.Length);

        // Crockford base32: I, L, O and U are left out so nothing is misheard
        // when a customer reads the reference down the phone.
        var suffix = reference["BB-20260102-".Length..];
        Assert.True(suffix.All(character => !"ILOU".Contains(character, StringComparison.Ordinal)));
    }

    [Fact]
    public void OrderReferencesDoNotCollide()
    {
        var today = DateTimeOffset.UtcNow;
        var references = Enumerable.Range(0, 2_000)
            .Select(_ => Identifier.OrderReference(today))
            .ToHashSet();

        // Same day, so only the random suffix separates them. Two thousand
        // five-digit suffixes would have collided with near certainty.
        Assert.Equal(2_000, references.Count);
    }
}
