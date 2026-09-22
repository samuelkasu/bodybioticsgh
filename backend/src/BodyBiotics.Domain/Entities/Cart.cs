namespace BodyBiotics.Domain.Entities;

/// <summary>
/// Server-side cart, keyed by user when signed in and by an anonymous cookie
/// otherwise. The Redux cart on the client is the optimistic mirror; this copy
/// is what survives reinstalling the PWA, switching device, or iOS evicting
/// the origin's storage.
/// </summary>
public sealed class Cart
{
    public required string Id { get; init; }
    public string? UserId { get; set; }
    public User? User { get; set; }

    /// <summary>Identifier from the anonymous cart cookie, before sign-in.</summary>
    public string? AnonId { get; set; }

    /// <summary>
    /// The coupon the customer has applied, upper-case. Kept on the cart rather
    /// than sent at checkout so the client never carries anything that affects
    /// a price, and so a code survives a reload, a second device and signing in
    /// halfway through.
    /// </summary>
    public string? CouponCode { get; set; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<CartItem> Items { get; init; } = [];

    public int SubtotalMinor => Items.Sum(item => item.LineTotalMinor);

    public int ItemCount => Items.Sum(item => item.Quantity);
}

public sealed class CartItem
{
    public const int MaxQuantityPerLine = 99;

    public required string Id { get; init; }
    public required string CartId { get; init; }
    public Cart? Cart { get; init; }

    public required string ProductId { get; init; }
    public Product? Product { get; init; }

    public int Quantity { get; set; } = 1;

    /// <summary>
    /// Priced from the product at read time, not stored: a cart shows today's
    /// price, including a sale that started while it sat there. Orders are the
    /// opposite — see <see cref="OrderItem"/>.
    /// </summary>
    public int LineTotalMinor =>
        (Product?.EffectivePriceMinor(DateTimeOffset.UtcNow) ?? 0) * Quantity;

    public static int ClampQuantity(int quantity) =>
        Math.Clamp(quantity, 0, MaxQuantityPerLine);
}
